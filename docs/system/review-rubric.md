# Fixed reviewer forms and scoring source (T03 / #17)

Source of authority: the user's 2026-10-23 supplied description of two reviewer forms, ordinary and employer. No other source files were supplied. This is the fixed review form contract for Phase 0; the Persian question labels below preserve the supplied message; formatting and machine keys are an implementation proposal, not a request for an unavailable external file. Figma is not the authority for these scores. Machine keys and storage boundaries are **proposed**; supplied scoring ranges, weights and question content are **confirmed source content**. This specification does not implement or execute a review.

## Shared identity, versions and calculations

Each evaluation belongs to one active reviewer assignment in one round, which identifies the exact application and proposal revision. Both forms show proposal title, proposer/provider and proposal code; reviewer full name, academic rank, specialty and organization. The employer form also shows reviewer position. Authoritative case and assigned-person records supply these values; the reviewer must not be able to impersonate another person by editing a header. Capture the displayed identities in the finalized evaluation snapshot. Both forms include signature and date fields; how to collect/verify a signature and whether either is required at finalization remain open.

| Section | Source weight | Raw maximum | Weighted maximum |
| --- | ---: | ---: | ---: |
| A — innovation and technology | 45% | 64 | 28.8 |
| B — market and development | 40% | 51 | 20.4 |
| C — submitted documents/evidence | 15% | 39 | 5.85 |
| **Total** | **100%** | **154** | **55.05** |

The **exact supplied formula** is `0.45 × A + 0.40 × B + 0.15 × C`. Its maximum is **55.05**, not 100. Do not normalize, rescale, invent a pass mark, or automatically advance a case from this number. Backend computes raw section totals and weighted total from the versioned row values; a client-supplied total is ignored/rejected. Numeric precision, rounding/display rule, cross-review aggregation, ties and how the chief uses the four results are **open decisions**. Keep unrounded source values internally until a rule is approved. A finalized evaluation must use the active form version and active assignment; a draft never counts toward 4/4. The chief explicitly decides whether to advance after four valid finalized evaluations.

The same A/B/C quantitative rows apply to ordinary and employer forms. Source row numbers in section C are irregular; preserve them as source metadata alongside stable machine keys. Each row may have a comment "if needed"; these comments are optional and do not alter the numeric score. The UI should show the range/choice exactly and give a field-keyed explanation when the server rejects an out-of-range or inconsistent score. Whether an unanswered non-scoring qualitative item blocks finalization remains open and must be versioned when decided.

## A — innovation and technology, raw maximum 64

| Key / source row | Persian display wording | Score contract | Maximum / unresolved detail |
| --- | --- | --- | --- |
| `a.technologyLevel` / A1 | سطح فناوری محصول | Low / پایین `0–3`; mid / متوسط `4–6`; high / بالا `7–9`. Record chosen tier and score within that tier. | 9 |
| `a.interdisciplinary` / A2 | میزان بین رشته‌ای بودن محصول | Numeric `0–9`. | 9; descriptive anchors not supplied. |
| `a.innovation` / A3 | نوآوری محصول (مجموع موارد پایین): مقاله، پتنت داخلی، در سطح بین‌المللی | Component sum: articles `2` points, domestic patents `3` each with domestic component capped at `9`, international level `9`. | 20 total. How many articles count, whether international level is binary or graded, and evidence rules are open. Enforce overall `0–20` without fabricating subitem rules. |
| `a.customization` / A4 | ظرفیت سفارشی‌سازی محصول (تولید بر اساس مشخصات مورد نظر مشتری) | Numeric `0–9`. | 9; descriptive anchors not supplied. |
| `a.developmentMethod` / A5 | روش توسعه فناوری محصول | **Exactly one**: reverse engineering / مهندسی معکوس `0–3`; improvement / بهبود `4–6`; internationally new idea or university–industry R&D know-how / ایده نو در سطح بین‌المللی یا دانش فنی حاصل از تحقیق و توسعه دانشگاه و صنعت `7–9`. | 9 |
| `a.environment` / A6 | سازگاری محصول با محیط زیست (مستقیم یا غیرمستقیم در فرآیند مصرف یا بهره‌برداری) | Weak / ضعیف `0–2`; medium / متوسط `3–5`; appropriate / مناسب `6–8`. | 8 |

The source's A3 component figures `2 + 9 + 9 = 20` explain its ceiling, but do not settle article multiplicity or the exact evidence-to-points mapping. Keep separate component fields and a calculated row total only after these ambiguities are resolved; until then a proposed UI may display the supplied rubric without asserting a subitem calculation.

## B — market and development, raw maximum 51

| Key / source row | Persian display wording | Score contract | Maximum / unresolved detail |
| --- | --- | --- | --- |
| `b.developmentStage` / B1 | محصول از نظر سطح توسعه فناوری در چه مرحله‌ای است؟ | Laboratory / آزمایشگاهی `0–3`; pilot / پایلوت `4–6`; industrial / صنعتی `7–9`. Record tier and score. | 9 |
| `b.addedValue` / B2 | ارزش افزوده محصول | Numeric `0–9`. | 9; descriptive anchors not supplied. |
| `b.marketReach` / B3 | بازار و تقاضای موجود | Oil, gas and petrochemicals / نفت، گاز و پتروشیمی `0–5`; national market in other industries / بازار ملی سایر صنایع `6–10`; international / بین‌المللی `11–15`. Record tier and score. | 15 |
| `b.futureOilGasDemand` / B4 | بازار و تقاضای آتی صنعت نفت، گاز و پتروشیمی | Numeric `0–9`. | 9; descriptive anchors not supplied. |
| `b.importSubstitution` / B5 | ظرفیت جایگزینی محصول با کالاهای مشابه وارداتی | Numeric `0–9`. | 9; descriptive anchors not supplied. |

## C — documentation and evidence, raw maximum 39

The source jumps from rows 1 to 3, 4, 5 and 7; do not renumber the published form or treat missing row numbers as unseen questions. The supplied footnote explicitly defines starred rows 3, 4 and 5 as **0 or n points**. These are binary 0/5, 0/10 and 0/10 items, with no intermediate score.

| Stable key / **source row** | Persian display wording | Score contract | Maximum |
| --- | --- | --- | ---: |
| `c.technicalReportQuality` / 1 | کیفیت گزارش فنی فناوری تولید محصول | Weak / ضعیف `0–3`; medium / متوسط `4–6`; appropriate with evidence / مناسب همراه با مستندات `7–9`. | 9 |
| `c.scientificAuthorityEndorsement` / **3*** | تأییدیه علمی از مراجع ذی‌صلاح (دانشگاه، پارک علم و فناوری‌ها، پژوهشگاه‌ها) | Binary `0` or `5`. | 5 |
| `c.nationalStandard` / **4*** | تأییدیه استاندارد ملی | Binary `0` or `10`. | 10 |
| `c.isoProductQuality` / **5*** | گواهینامه کیفیت محصول (ایزو) | Binary `0` or `10`. | 10 |
| `c.salesContracts` / **7** | قراردادهای فروش محصول (بر اساس تعدد قرارداد و میزان فروش محصول در هر قرارداد) | Numeric `0–5`. | 5 |

## Ordinary reviewer: qualitative questions and closing fields

The ordinary form has **13 yes/no questions**. Each proposed key stores `yes | no | unanswered` while drafting. The questions do not enter A/B/C arithmetic. Source wording is rendered in Persian here; the exact mandatory-answer rule is open.

| Key | Persian question wording |
| --- | --- |
| `q.technicalApproachClear` | آیا رویکرد فنی به وضوح تعریف شده است؟ |
| `q.objectivesAchievableOnTime` | آیا اهداف پروپوزال در چارچوب زمان پیشنهادی قابل دستیابی هستند؟ |
| `q.scientificPrinciplesSound` | آیا پروپوزال درک مناسبی از اصول فنی و علمی مربوطه را نشان می‌دهد؟ |
| `q.operationsDetailedRealistic` | آیا برنامه‌های عملیاتی دقیق و واقع‌گرایانه هستند؟ |
| `q.resourcesListed` | آیا فهرستی از منابع مورد نیاز (پرسنل، امکانات و غیره) ارائه شده است؟ |
| `q.scheduleExecutable` | آیا زمان‌بندی‌های اجرایی منطقی و عملی بودنِ آنها مشخص است؟ |
| `q.budgetBreakdown` | آیا تفکیک بودجه به وضوح شامل شده است؟ |
| `q.costsJustified` | آیا هزینه‌های پیش‌بینی‌شده با نتایج مورد انتظار توجیه شده‌اند؟ |
| `q.costBenefitAnalysis` | آیا پروپوزال شامل یک تحلیل هزینه-فایده است؟ |
| `q.environmentalImpactsIdentified` | آیا پروپوزال تأثیرات زیست‌محیطی بالقوه را شناسایی کرده است؟ |
| `q.environmentalMitigation` | آیا تدابیری برای کاهش تأثیرات منفی زیست‌محیطی پیشنهاد شده است؟ |
| `q.riskAssessmentDone` | آیا ارزیابی ریسک انجام شده است؟ |
| `q.risksMitigated` | آیا ریسک‌های شناسایی‌شده به‌عنوان استراتژی‌های کاهش مناسب پوشش داده شده‌اند؟ |

The closing recommendation uses exactly five options: `strongly_recommend` (به شدت توصیه می‌کنم), `recommend` (توصیه می‌کنم), `neutral` (بی‌طرف), `not_recommend` (توصیه نمی‌کنم), `strongly_not_recommend` (به شدت توصیه نمی‌کنم). The form also asks for **top-five suitability with brief reasons** (به نظر شما طرح بررسی‌شده شایستگی پذیرفته‌شدن در ۵ طرح برگزیده نهایی این رویداد را دارد؟ دلیل یا دلایل خود را مختصراً بیان فرمایید.). Whether that is a yes/no judgment, rank, or free-text rationale requires clarification; preserve its answer and rationale without inventing an aggregation rule.

The ordinary form has optional suggested-reviewer fields: name, academic rank, specialty, organization, landline, mobile and email. It also has blank honorarium/compensation fields: account number, bank, branch, account-holder name, email, phone, work address and home address. No actual payment data was supplied. These are sensitive internal administrative data, excluded from company/public/other-reviewer projections and exports. **Proposed separation:** keep them in a restricted compensation/contact record rather than the general evaluation DTO or score snapshot; whether they are required or collected at all in the digital flow is an open decision. Never expose account/address fields through a case message or reviewer summary.

## Employer reviewer: risk checklist and closing fields

The employer's qualitative section is a **risk checklist**, not the ordinary 13 questions. Use a versioned group key and item key; each answer's exact type and requiredness (yes/no, severity, narrative or combination) remain open because the supplied description names topics but no response scale. Keep comments/evidence separately from numeric A/B/C scores.

| Group key | Persian group title | Item keys and Persian prompts/topics |
| --- | --- | --- |
| `risk.assessment` | ارزیابی ریسک | `done`: آیا ارزیابی ریسک انجام شده است؟ |
| `risk.financial` | ریسک مالی | `budgetSufficiency`: آیا بودجه کافی برای این پروژه وجود دارد؟ `costDrivers`: چه عواملی می‌توانند بر هزینه‌های پروژه تأثیر بگذارند؟ `minMaxCosts`: حداقل و حداکثر هزینه‌هایی که ممکن است اتفاق بیافتد را بیان کنید. |
| `risk.technical` | ریسک فنی | `newTechnology`: آیا تکنولوژی مورد استفاده در پروژه جدید است؟ `teamSkills`: آیا تیم فنی مهارت‌های لازم برای اجرا را دارد؟ `materialsEquipmentTimely`: آیا تجهیزات و مواد لازم به موقع تهیه خواهند شد؟ `productionIssues`: چه مشکلاتی ممکن است در فرایند تولید یا اجرا بروز کند؟ |
| `risk.schedule` | ریسک زمان‌بندی | `schedule`: زمان‌بندی پروژه چگونه است؟ `supplyDelays`: آیا ممکن است تأخیر در تأمین مواد اولیه یا تجهیزات به‌وجود آید؟ `otherTimingFactors`: چه عواملی می‌توانند بر زمان‌بندی پروژه تأثیر بگذارند؟ |
| `risk.legal` | ریسک حقوقی | `permits`: آیا مجوزهای لازم برای پروژه دریافت شده است؟ `localNationalCompliance`: آیا این پروژه به قوانین و مقررات محلی یا ملی پایبند است؟ `futureIssues`: آیا ممکن است در آینده مشکلات حقوقی به‌وجود بیاید؟ |
| `risk.human` | ریسک نیروی انسانی | `teamSizeSkills`: آیا اعضای تیم از نظر تعداد و مهارت کافی هستند؟ `tensionsConflicts`: آیا تنش‌ها و تضادهای بین اعضای تیم وجود دارد؟ `training`: آیا برنامه‌ای برای آموزش و توسعه کارکنان وجود دارد؟ |
| `risk.environment` | ریسک زیست‌محیطی | `negativeImpacts`: آیا پروژه تأثیرات منفی بر محیط زیست خواهد گذاشت؟ `mitigation`: آیا برنامه‌ای برای کاهش تأثیرات زیست‌محیطی وجود دارد؟ |
| `risk.stakeholders` | ریسک ذی‌نفعان | `keyStakeholders`: ذی‌نفعان کلیدی پروژه چه کسانی هستند؟ `support`: آیا حمایت کافی از طرف ذی‌نفعان وجود دارد؟ `conflicts`: آیا ممکن است تضاد منافع با ذی‌نفعان باشد؟ |
| `risk.external` | ریسک عوامل بیرونی | `economicPoliticalSocial`: آیا تغییرات اقتصادی، سیاسی یا اجتماعی ممکن است بر پروژه تأثیر بگذارد؟ `unpredictable`: چه امور غیرقابل پیش‌بینی وجود دارد که ممکن است بر پروژه تأثیرگذار باشد؟ |

The employer form ends with the same five-option overall recommendation and top-five suitability with brief reasons as the ordinary form. It also has signature/date. Employer `position` is part of the identity header. There is no employer honorarium block in the supplied description.

## Instructional copy, validation and access

Both source letters ask reviewers to return a completed form **within one week**. Record that as instructional copy in the form's text version. It is **not** authorization for an automatic deadline, expiry, reassignment, notification schedule or rejection; those require an explicit workflow rule.

The cover letters name Secretariat as the recipient. The supplied form content does not define a new application transition: the approved case workflow still routes independent evaluations to the responsible chief's decision and uses Secretariat for its stated duties. No extra automated handoff is inferred from the cover-letter wording. The employer's financial-risk questions also do not grant access to the later restricted financial package.

The FE renders the active form variant for the server-identified assignment, its version and allowed actions, with Persian RTL text, draft persistence, field-specific errors, a review of calculated totals and a distinct finalize action. A stale rubric/round/assignment produces a conflict and refresh; it must not silently attach answers to a new round. The BE validates tier-score consistency, numerical bounds, A3 subcomponents once clarified, applicable qualitative answer schema, ownership and current version; it calculates scores. A finalized evaluation is locked against normal edits. Reviewer reads contain only their own evaluation and necessary dossier fields. The chief's authorized summary and assigned investment person's permitted result projection are separate; other reviewers cannot inspect individual evaluations or financial-stage files. Company-visible outcome is a separately published text, never this form or its score.

## Open decisions after receipt of the forms

1. A3 article count/points and evidence, and international-level choice/points. The C3/C4/C5 starred-item binary rule is already supplied and resolved.
2. Score decimal precision and rounding for storage/display; aggregation or comparison across four reviews, ties and any chief-facing summary calculation. No automatic advancement or pass mark is approved.
3. Which qualitative/checklist fields, recommendation, top-five answer, comment, signature and date are mandatory at finalization; employer checklist response type; exact top-five semantics.
4. Whether the one-week instructional request is displayed in every digital form version; routine copy review uses the supplied message and does not require an external form file.
5. Restricted retention/collection policy for suggested reviewers and honorarium contact/bank/address fields.

Q39 private-file formats/sizes/counts and the non-compete/event-rules text remain separate open inputs in [fixed-form contracts](fixed-form-contracts.md). This rubric source resolves the previously open core questions, ranges, weights and formula while leaving the listed implementation decisions explicit.
