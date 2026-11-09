import { CollapsibleCard } from '@/components/dashboard/company-detail/company-detail-parts'
import { Typography } from '@/components/ui/typography'
import { formatDate, type RequestDetail } from '@/utilities/dashboard-api'

import { FieldGrid, LabelledField, answerText } from './request-fields'

type CompanyProfile = NonNullable<RequestDetail['companyProfile']>

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : []

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.flatMap((item) => (typeof item === 'string' && item.trim() ? [item.trim()] : [])) : []

/** An ISO date is shown in the Persian calendar; a date the company typed itself stays as typed. */
const dateText = (value: string): string => (/^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value) : value)

/**
 * «رزومه و اطلاعات شرکت» (Figma 73151): the company's own live profile and resume, read next to its
 * request. The server sends this block to the company only, so no other role ever draws it. Values
 * the company has not filled in show a dash; a list nobody filled in is left out.
 */
export function RequestCompanyProfileCard({ profile }: { profile: CompanyProfile }) {
  const { company, dossier } = profile
  const products = strings(dossier.productsServices)
  const requested = strings(dossier.requestedServices)
  const members = list(dossier.keyMembers)
  const projects = list(dossier.pastProjectsCustomers)
  const certificates = list(dossier.certificatesLicenses)
  const insured = dossier.insuredEmployeeCount

  return (
    <CollapsibleCard title="رزومه و اطلاعات شرکت">
      <div data-testid="request-company-profile" className="flex flex-col gap-6">
        <FieldGrid>
          <LabelledField tone="input" label="نام شرکت" value={company.name} />
          <LabelledField tone="input" label="نوع شرکت" value={company.type} />
          <LabelledField tone="input" label="وضعیت شرکت" value={company.status} />
          <LabelledField tone="input" label="تاریخ تأسیس" value={dateText(company.establishmentDate)} />
          <LabelledField tone="input" label="شناسه ملی" value={company.nationalId} />
          <LabelledField tone="input" label="شماره ثبت" value={company.registrationNumber} />
          <LabelledField tone="input" label="کد اقتصادی" value={company.economicCode} />
          <LabelledField tone="input" label="حوزه فعالیت اصلی" value={profile.activityDomain || text(dossier.activityDomain)} />
          <LabelledField tone="input" label="استان" value={profile.province} />
          <LabelledField tone="input" label="شهر" value={profile.city} />
          <LabelledField tone="input" label="نوع شخصیت حقوقی" value={text(dossier.legalEntityType)} />
          <LabelledField tone="input" label="طبقه‌بندی شرکت" value={text(dossier.classification)} />
          <LabelledField tone="input" label="وضعیت دانش‌بنیان" value={text(dossier.knowledgeBasedStatus)} />
          <LabelledField tone="input" label="سال تأسیس" value={text(dossier.foundingYear)} />
          <LabelledField tone="input" label="وب‌سایت" value={text(dossier.website)} />
          <LabelledField tone="input" label="محل استقرار مرکز" value={text(dossier.centerEstablishment)} />
          <LabelledField
            tone="input"
            label="تعداد بیمه‌شدگان"
            value={typeof insured === 'number' ? insured.toLocaleString('fa-IR') : ''}
          />
        </FieldGrid>

        {profile.executives.length ? (
          <ProfileList title="مدیران و اعضای هیئت‌مدیره">
            {profile.executives.map((executive, index) => (
              <ProfileRow key={`${index}-${executive.name}`} title={executive.name} meta={executive.role} />
            ))}
          </ProfileList>
        ) : null}

        {profile.addresses.length ? (
          <ProfileList title="نشانی‌ها">
            {profile.addresses.map((address) => (
              <ProfileRow
                key={address.id}
                title={address.title}
                meta={[address.province, address.city, address.address].filter(Boolean).join('، ')}
                note={address.postalCode ? `کد پستی: ${address.postalCode}` : undefined}
              />
            ))}
          </ProfileList>
        ) : null}

        {products.length ? (
          <ProfileList title="محصولات و خدمات">
            {products.map((item) => (
              <ProfileRow key={item} title={item} />
            ))}
          </ProfileList>
        ) : null}

        {members.length ? (
          <ProfileList title="اعضای کلیدی">
            {members.map((member, index) => (
              <ProfileRow key={`${index}-${text(member.name)}`} title={answerText(member.name)} meta={text(member.role)} />
            ))}
          </ProfileList>
        ) : null}

        {projects.length ? (
          <ProfileList title="پروژه‌ها و مشتریان پیشین">
            {projects.map((project, index) => (
              <ProfileRow
                key={`${index}-${text(project.project)}`}
                title={answerText(project.project)}
                meta={text(project.customer)}
                note={text(project.summary) || undefined}
              />
            ))}
          </ProfileList>
        ) : null}

        {requested.length ? (
          <ProfileList title="خدمات درخواستی">
            {requested.map((item) => (
              <ProfileRow key={item} title={item} />
            ))}
          </ProfileList>
        ) : null}

        {certificates.length ? (
          <ProfileList title="گواهینامه‌ها و مجوزها">
            {certificates.map((certificate, index) => (
              <ProfileRow
                key={`${index}-${text(certificate.title)}`}
                title={answerText(certificate.title)}
                meta={text(certificate.issuer)}
                note={text(certificate.reference) ? `شماره مرجع: ${text(certificate.reference)}` : undefined}
              />
            ))}
          </ProfileList>
        ) : null}
      </div>
    </CollapsibleCard>
  )
}

function ProfileList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <Typography as="h3" variant="16/semibold" color="neutral-800">
        {title}
      </Typography>
      <ul className="flex flex-col gap-2">{children}</ul>
    </div>
  )
}

function ProfileRow({ title, meta, note }: { title: string; meta?: string; note?: string }) {
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-lg border border-neutral-100 p-3">
      <Typography variant="14/semibold" sm="16/semibold" color="neutral-800" className="break-words">
        {title}
      </Typography>
      {meta ? (
        <Typography variant="14/regular" color="neutral-600" className="break-words">
          {meta}
        </Typography>
      ) : null}
      {note ? (
        <Typography variant="12/regular" sm="14/regular" color="neutral-500" className="whitespace-pre-wrap break-words">
          {note}
        </Typography>
      ) : null}
    </li>
  )
}
