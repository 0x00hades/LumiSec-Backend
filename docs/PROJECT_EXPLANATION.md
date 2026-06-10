# LumiSec Backend - شرح مفصل للمشروع

هذا الملف يشرح المشروع بشكل عملي ومنهجي: كيف يبدأ التطبيق، كيف يمر الـ request داخل النظام، ما هي الموديولات الموجودة، وكيف ترتبط القاعدة، الـ middleware، الـ queues، والـ tests ببعضها.

## 1) فكرة المشروع

LumiSec Backend هو API server مبني بـ Node.js و Express ويخدم أكثر من مجال أمني في نفس الوقت:

- Auth لإدارة الدخول والصلاحيات.
- SOAR لإدارة incidents و playbooks.
- Phishing لإدارة حملات التصيّد وتتبع التفاعل.
- UCTC لإدارة Sigma rules وتحويلها ونشرها.
- GRC لإدارة findings و remediation tasks.

المشروع مصمم كمنصة Security Operations موحدة، بحيث كل جزء أمني له module مستقل لكن كلها تشترك في نفس طبقة التشغيل:

- قاعدة بيانات MongoDB عبر Mongoose.
- طبقة middleware موحدة.
- handling موحد للأخطاء والـ responses.
- background jobs عبر Bull + Redis.
- real-time alerts عبر Socket.IO.

---

## 2) هيكل التشغيل العام

### نقطة البداية

الملف [index.js](../index.js) هو نقطة تشغيل التطبيق الأساسية. وظيفته:

1. تحميل متغيرات البيئة من `config/.env`.
2. إنشاء Express app.
3. إنشاء HTTP server.
4. تفعيل Socket.IO عبر `initSocket`.
5. الاتصال بقاعدة البيانات عبر `connectDB()`.
6. تسجيل الـ routes والـ middleware عبر `bootstrap(app, express)`.
7. تشغيل السيرفر على `PORT` من البيئة أو 3000 افتراضيًا.

### طبقة التجميع

الملف [src/bootstrap.js](../src/bootstrap.js) يجمع كل شيء متعلق بالـ HTTP layer:

- `express.json()` لقراءة JSON bodies.
- route `/health` لفحص حالة الخدمة.
- mount للـ routers تحت prefixes واضحة.
- route handler افتراضي للـ 404.
- global error handler في النهاية.

هذا الفصل مهم لأنه يجعل التطبيق أسهل في الاختبار، وأيضًا يسمح بإعادة استخدام نفس app factory في test files.

---

## 3) مسار أي Request داخل النظام

أي request يمر غالبًا بالترتيب التالي:

1. Router.
2. `isAuthenticated()` إذا كان endpoint محميًا.
3. `isAuthorized([...roles])` للتحقق من الدور.
4. `isValid(schema)` للتحقق من payload.
5. `asyncHandler(controller)` لالتقاط أي error async.
6. Controller ينفذ اللوجيك الحقيقي.
7. `successResponse()` أو `paginatedResponse()` للرد.
8. أي error يذهب إلى `globalErrorHandling()`.

### مثال عملي

عند طلب إنشاء Sigma rule:

- `POST /api/uctc/rules`
- يمر على auth middleware.
- يمر على authorization middleware.
- يمر على Joi validation.
- بعد ذلك يدخل `createRule`.
- يتم إنشاء rule في MongoDB.
- ثم يتم إرسال job إلى `ruleQueue` لتحويل Sigma إلى query مناسب للـ SIEM.

---

## 4) طبقة المصادقة Authorization / Authentication

### Authentication

الملف [src/middleware/authentication.js](../src/middleware/authentication.js) يقوم بالتالي:

- يقرأ `Authorization` header.
- يتأكد أنه يبدأ بـ `Bearer `.
- يستخرج التوكن.
- يتحقق منه عبر `verifyToken()`.
- يبحث عن المستخدم في قاعدة البيانات.
- يمنع الحسابات المعلقة `suspended`.
- يضع المستخدم في `req.authUser`.

إذا فشل أي شيء من ذلك، يرجع error مناسب مثل:

- `Authentication required`
- `Session expired, please login again`
- `Your account has been suspended`

### Authorization

الملف [src/middleware/authorization.js](../src/middleware/authorization.js) بسيط ومباشر:

- يتأكد أن `req.authUser` موجود.
- يقارن role الخاص بالمستخدم مع قائمة الأدوار المسموح بها.
- إذا لم يكن الدور مسموحًا، يرجع 403.

### الأدوار الموجودة

في [src/utils/constant/enums.js](../src/utils/constant/enums.js) يوجد تعريف للأدوار مثل:

- `admin`
- `soc_analyst`
- `soc_manager`
- `detection_engineer`
- `auditor`
- `compliance_manager`
- `it_manager`

وهذه الأدوار هي الأساس الذي تبنى عليه صلاحيات الوصول للـ APIs.

---

## 5) طبقة Validation

الملف [src/middleware/validation.js](../src/middleware/validation.js) يستخدم Joi schemas للتأكد من صحة البيانات قبل الدخول إلى controller.

### كيف يعمل

- يجمع `body` و `params` و `query` في object واحد.
- يمرره إلى schema.validate().
- إذا ظهر error، يعيد 422.
- يدمج رسائل الخطأ في رسالة واضحة واحدة.

### فائدة هذا الأسلوب

هذا يسمح باستخدام schema واحد للتأكد من:

- body fields.
- route params.
- query params.

مثال: `updateStatusValidation` في UCTC تتحقق من `status` و `ruleId` معًا.

---

## 6) طبقة Response و Error Handling

### Success Responses

الملف [src/utils/apiResponse.js](../src/utils/apiResponse.js) يحتوي على:

- `successResponse()` للـ responses العادية.
- `paginatedResponse()` للـ responses التي فيها pagination.

الهدف من هذا التوحيد هو أن كل API يرجع نفس الشكل الأساسي تقريبًا.

### Global Errors

الملف [src/middleware/globalErrorHandling.js](../src/middleware/globalErrorHandling.js) يستقبل كل الأخطاء ويقوم بـ:

- logging باستخدام winston logger.
- استخراج `statusCode` و `status`.
- إرجاع JSON موحد فيه:
  - `success: false`
  - `status`
  - `message`
  - `stack` في وضع development فقط

هذا يمنع تشتت منطق معالجة الأخطاء داخل controllers.

---

## 7) قاعدة البيانات والنماذج

### الاتصال بقاعدة البيانات

[database/connection.js](../database/connection.js) يتصل بـ MongoDB باستخدام `MONGO_URI`.

### تصدير النماذج

[database/index.js](../database/index.js) يعمل as a central export point لكل الـ models.

### النماذج الأساسية

#### User

[database/models/user.model.js](../database/models/user.model.js)

- name
- email
- password
- role
- status
- department
- lastLogin

#### SigmaRule

[database/models/sigmaRule.model.js](../database/models/sigmaRule.model.js)

- title
- description
- status
- rawSigma
- convertedQuery
- targetSiem
- mitreTactics
- mitreTechniques
- createdBy
- approvedBy
- deployedAt
- retiredAt

#### Incident

[database/models/incident.model.js](../database/models/incident.model.js)

- title
- severity
- status
- assignedTo
- createdBy
- sourceIP
- affectedHost
- playbookExecuted
- actions
- closedAt
- notes

#### Playbook

[database/models/playbook.model.js](../database/models/playbook.model.js)

- name
- triggerType
- triggerCondition
- actions
- createdBy
- isActive

#### Campaign

[database/models/campaign.model.js](../database/models/campaign.model.js)

- name
- template
- status
- createdBy
- landingPageUrl
- trackingDomain
- stats
- launchedAt

#### Recipient

[database/models/recipient.model.js](../database/models/recipient.model.js)

- campaign
- email
- trackingId
- riskScore
- emailSent
- sentAt

#### PhishingEvent

يُستخدم لتسجيل open/click/submit events المتعلقة بالحملات.

#### Finding

[database/models/finding.model.js](../database/models/finding.model.js)

- title
- description
- status
- riskRating
- severity
- control
- auditReport
- createdBy
- closedBy
- closedAt
- retestResult

#### RemediationTask

[database/models/remediationTask.model.js](../database/models/remediationTask.model.js)

- finding
- assignedTo
- assignedBy
- description
- dueDate
- evidence
- itValidation
- completedAt

#### AuditReport

مرتبط بفهارس GRC ويربط findings بالتقرير الرئيسي.

---

## 8) الـ Queues والخدمات الخلفية

الملف [src/utils/queue.js](../src/utils/queue.js) يعرّف أربع queues عبر Bull:

- `emailQueue`
- `soarQueue`
- `ruleQueue`
- `reportQueue`

### لماذا هذا مهم

بعض العمليات في المشروع ليست مناسبة للتنفيذ مباشرة داخل request/response cycle، مثل:

- إرسال emails.
- تنفيذ playbooks.
- تحويل Sigma rules.
- توليد التقارير.

لذلك يتم إرسال job إلى queue ثم worker منفصل ينفذها في الخلفية.

### الـ Workers

في `src/workers/` توجد workers مختلفة مثل:

- `emailWorker.js`
- `reportWorker.js`
- `ruleWorker.js`
- `soarWorker.js`

هذا design يفصل الـ API layer عن heavy processing.

---

## 9) الـ Modules بالتفصيل

## 9.1 Auth Module

### الراوتر

[src/modules/auth/auth.router.js](../src/modules/auth/auth.router.js)

Endpoints:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/profile`

### اللوجيك

[src/modules/auth/auth.controller.js](../src/modules/auth/auth.controller.js)

#### Signup

- يتأكد أن البريد غير مستخدم.
- يhash كلمة المرور باستخدام bcrypt.
- ينشئ User جديد.
- يصدر JWT token.
- يرجع user مختصر مع token.

#### Login

- يبحث عن المستخدم بالبريد.
- يقارن كلمة المرور.
- يحدث `lastLogin`.
- يصدر token جديد.

#### Profile

- يعيد المستخدم الذي تم تحميله بواسطة auth middleware.

### التحقق

الـ validation موجود في [src/modules/auth/auth.validation.js](../src/modules/auth/auth.validation.js).

---

## 9.2 UCTC Module

### الراوتر

[src/modules/uctc/uctc.router.js](../src/modules/uctc/uctc.router.js)

Endpoints:

- `POST /api/uctc/rules`
- `GET /api/uctc/rules`
- `POST /api/uctc/rules/:ruleId/deploy`

### اللوجيك

[src/modules/uctc/uctc.controller.js](../src/modules/uctc/uctc.controller.js)

#### createRule

- يأخذ `title`, `description`, `rawSigma`, `targetSiem`, `mitreTactics`, `mitreTechniques`.
- ينشئ SigmaRule في MongoDB.
- يرسل job إلى `ruleQueue` لتحويل Sigma rule.
- يرجع rule بحالة مبدئية `draft` غالبًا.

#### getRules

- يدعم pagination via `page` و `limit`.
- يدعم filter بـ `status`.
- يعيد rules مع `createdBy` population.

#### deployRule

- يبحث عن rule بـ id.
- يتأكد أنها موجودة.
- يمنع deploy قبل أن تكون الحالة `converted`.
- يغيّر الحالة إلى `deployed`.
- يضبط `deployedAt` و `approvedBy`.

### ملاحظة مهمة

في الكود الحالي لا يوجد endpoint مباشر لتحويل Sigma rule؛ التحويل متوقع أن يتم في worker أو خدمة خارجية.

---

## 9.3 SOAR Module

### الراوتر

[src/modules/soar/soar.router.js](../src/modules/soar/soar.router.js)

Endpoints:

- `POST /api/soar/incidents`
- `GET /api/soar/incidents`
- `POST /api/soar/incidents/:incidentId/playbook/:playbookId`
- `PATCH /api/soar/incidents/:incidentId/close`

### اللوجيك

[src/modules/soar/soar.controller.js](../src/modules/soar/soar.controller.js)

#### createIncident

- ينشئ Incident جديد.
- لو `playbookId` موجود، يتحقق من playbook.
- يربط playbook بالـ incident.
- يرسل job إلى `soarQueue` لتنفيذ playbook.
- يطلق real-time alert عبر `emitAlert()`.

#### executePlaybook

- يتحقق من وجود incident و playbook.
- يرسل job إلى queue فقط.
- لا ينفذ playbook مباشرة داخل request.

#### closeIncident

- يبحث عن incident.
- يمنع الإغلاق لو كان مغلقًا مسبقًا.
- يضبط status إلى `closed` أو `false_positive`.
- يكتب notes و closedAt.
- يرسل alert إلى SOC manager.

#### getIncidents

- يدعم filter بـ severity و status.
- يدعم pagination.
- يعيد incidents مع populated users.

---

## 9.4 Phishing Module

### الراوتر

[src/modules/phishing/phishing.router.js](../src/modules/phishing/phishing.router.js)

Endpoints:

- `POST /api/phishing`
- `POST /api/phishing/:campaignId/launch`
- `GET /api/phishing`
- `POST /api/phishing/track/:trackingId`

### اللوجيك

[src/modules/phishing/phishing.controller.js](../src/modules/phishing/phishing.controller.js)

#### createCampaign

- ينشئ حملة جديدة من template.
- يربطها بالمستخدم الذي أنشأها.

#### launchCampaign

- يتحقق من الحملة.
- يمنع الإطلاق لو كانت ليست draft.
- يبحث عن recipients غير المرسلين.
- يضع job لكل recipient في `emailQueue`.
- يغيّر status إلى `active`.

#### trackEvent

- endpoint عام بدون auth.
- يستخدم `trackingId` للعثور على recipient.
- يسجل event في `PhishingEvent`.
- يحدّث riskScore.
- يحدّث stats الخاصة بالحملة.
- يرسل alert إلى SOC.
- لو النوع `open` يرجع pixel صغير 1x1.

#### getCampaigns

- pagination.
- population لـ createdBy.

### ملحوظة

هذا module فيه endpoint عام مقصود لأنه يمثل tracking link يفتحه الضحية في المتصفح.

---

## 9.5 GRC Module

### الراوتر

[src/modules/grc/grc.router.js](../src/modules/grc/grc.router.js)

Endpoints:

- `POST /api/grc/findings`
- `GET /api/grc/findings`
- `PATCH /api/grc/findings/:findingId/close`
- `POST /api/grc/tasks`

### اللوجيك

[src/modules/grc/grc.controller.js](../src/modules/grc/grc.controller.js)

#### createFinding

- ينشئ finding جديد.
- لو `auditReportId` موجود، يضيف finding إلى التقرير.

#### createRemediationTask

- يتأكد من وجود finding.
- ينشئ remediation task.
- يغيّر حالة finding إلى `in_progress`.

#### closeFinding

- يسمح فقط بـ auditor أو admin.
- يتأكد أن status الحالي `pending_retest`.
- لو `retestResult = ineffective` يرجع finding إلى `reopened`.
- لو `effective` يغلقه ويملأ closedBy و closedAt.

#### getFindings

- pagination.
- filters على status و riskRating.
- population لـ createdBy.

---

## 10) الـ Integrations الخارجية

المشروع لديه عدة integrations جاهزة أو شبه جاهزة تحت [src/integrations](../src/integrations):

- `elk.js`
- `firewall.js`
- `mailer.js`
- `opencti.js`
- `ssh.js`
- `winrm.js`

فكرة هذه الملفات أنها تعمل interface مع خدمات خارجية مختلفة حسب use case:

- ELK / Splunk / Sentinel للـ detection rules.
- SMTP لإرسال البريد.
- OpenCTI لجلب threat intel.
- SSH / WinRM لتنفيذ actions على الأنظمة.

بعضها قد يكون مستخدمًا الآن في workers أو في controller cases محددة، وبعضها قد يكون مهيأ للتوسعة مستقبلًا.

---

## 11) الـ Socket.IO

الملف [src/utils/socket.js](../src/utils/socket.js) يفعّل real-time events.

### استخدامه في المشروع

- إرسال alerts إلى SOC analyst عند incident جديد.
- إرسال alerts عند phishing events.
- إرسال notifications عند actions أمنية أخرى.

هذا يسمح للتطبيق أن لا يعتمد فقط على polling أو refresh يدوي.

---

## 12) التعامل مع الأخطاء

المشروع لا يترك الأخطاء تتسرّب بشكل خام. عند حدوث خطأ:

- إذا كان خطأ متوقعًا، يتم إنشاؤه بـ `AppError`.
- إذا كان validation error، يتم إرجاع 422.
- إذا كان authentication/authorization error، يتم إرجاع 401 أو 403.
- إذا كان شيء غير متوقع، يمر على global handler ويعود كـ 500.

هذا مهم جدًا لأن الـ API clients و Postman tests يحصلون على responses ثابتة وقابلة للفهم.

---

## 13) كيف تختبر المشروع عمليًا

### تشغيل السيرفر

- `npm install`
- `npm run dev`

### health check

- `GET /health`

### استخدام Postman

في مجلد [postman](../postman) يوجد collection جاهز:

- `LumiSec-API.postman_collection.json`

بعد import:

1. غيّر `baseUrl` لو مشروعك شغال على port مختلف.
2. نفّذ `Signup` أو `Login`.
3. خذ `token` من الـ collection variables.
4. جرّب باقي الـ requests.

### ملاحظات مهمة أثناء الاختبار

- بعض الـ endpoints تحتاج roles محددة.
- بعض العمليات تعتمد على بيانات موجودة مسبقًا في DB.
- بعض الـ features تعتمد على queues و workers و Redis.
- tracking endpoint في phishing لا يحتاج token.

---

## 14) الاختبارات الآلية

تم تجهيز tests في مجلد [test](../test):

- `auth.api.test.js`
- `uctc.api.test.js`
- `soar.api.test.js`
- `phishing.api.test.js`
- `grc.api.test.js`
- `health.api.test.js`

الاختبارات تعتمد على:

- `node:test`
- `supertest`
- `mongodb-memory-server`

### الهدف من الاختبارات

- التأكد من أن الـ routes شغالة.
- التأكد من أن auth و authorization تعملان كما هو متوقع.
- التأكد من أن validation errors ترجع بشكل صحيح.
- التأكد من أن الـ happy paths الأساسية لا تكسر.

---

## 15) نقاط قوة التصميم الحالي

- modular architecture واضحة.
- فصل بين controller والvalidation والmiddleware.
- استخدام queues للعمليات البطيئة.
- وجود responses موحدة.
- قابلية جيدة لإضافة modules جديدة.
- دعم جيد للاختبار بعد فصل `createApp()` عن `index.js`.

---

## 16) نقاط تحتاج تطوير لاحقًا

- بعض الـ background workers يحتاج توثيق أوسع لو أردت تشغيلًا production-ready.
- بعض الـ routes تعتمد على بيانات أو خدمات خارجية، وبالتالي تحتاج mocking في tests الأعمق.
- يمكن إضافة OpenAPI/Swagger لتوثيق الـ endpoints تلقائيًا.
- يمكن توسيع Postman collection بـ example responses لكل endpoint.

---

## 17) الخلاصة

المشروع هو backend platform أمني متعدد الوحدات، يعتمد على Express + MongoDB + JWT + Bull + Socket.IO. الفكرة الأساسية هي أن كل جزء أمني له مسؤولية محددة، لكن كل الأجزاء تشترك في نفس المعمارية: route -> auth -> validation -> controller -> response -> queue/socket عند الحاجة.

لو أردت فهم المشروع بسرعة، ابدأ بهذا الترتيب:

1. [index.js](../index.js)
2. [src/bootstrap.js](../src/bootstrap.js)
3. [src/middleware/authentication.js](../src/middleware/authentication.js)
4. [src/middleware/authorization.js](../src/middleware/authorization.js)
5. [src/modules/auth/auth.controller.js](../src/modules/auth/auth.controller.js)
6. [src/modules/uctc/uctc.controller.js](../src/modules/uctc/uctc.controller.js)
7. [src/modules/soar/soar.controller.js](../src/modules/soar/soar.controller.js)
8. [src/modules/phishing/phishing.controller.js](../src/modules/phishing/phishing.controller.js)
9. [src/modules/grc/grc.controller.js](../src/modules/grc/grc.controller.js)
10. [postman/LumiSec-API.postman_collection.json](../postman/LumiSec-API.postman_collection.json)
