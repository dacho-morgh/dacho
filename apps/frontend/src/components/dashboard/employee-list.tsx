'use client'

import { OPERATIONAL_ROLE_LABELS } from '@cms-core/access/roles'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Typography } from '@/components/ui/typography'
import {
  PersonnelForm,
  RequestError,
  adminRequest,
  cardClass,
  controlClass,
  loadPeople,
  type Person,
} from './owner-admin'

export function EmployeeList({ canManage = false }: { canManage?: boolean }) {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState<Person | 'new' | null>(null)
  const [saved, setSaved] = useState(false)
  const [query, setQuery] = useState('')
  useEffect(() => {
    let current = true

    const request = canManage
      ? loadPeople()
      : adminRequest('/api/dashboard/admin/employees?limit=100').then(
          (data) => data.items as Person[],
        )
    request
      .then((items) => {
        if (current) setPeople(items)
      })
      .catch((error) => {
        if (current) setError(error)
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [attempt, canManage])
  function refresh() {
    setLoading(true)
    setError(null)
    setAttempt((value) => value + 1)
  }
  return (
    <main dir="rtl" className="flex min-w-0 flex-1 flex-col gap-5 p-4 lg:pt-10">
      <Typography variant="h3">کارکنان</Typography>
      {saved && (
        <Typography role="status" variant="14/regular" color="success">
          اطلاعات ذخیره شد.
        </Typography>
      )}
      {editing !== null ? (
        <PersonnelForm
          key={editing === 'new' ? 'new' : editing.id}
          person={editing === 'new' ? undefined : editing}
          onCancel={() => {
            setEditing(null)
            refresh()
          }}
          onSaved={() => {
            setEditing(null)
            setSaved(true)
            refresh()
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              aria-label="جستجوی کارمند"
              placeholder="جستجوی کارمند"
              className={`${controlClass} max-w-full sm:w-[400px]`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {canManage && (
              <Button
                size="48"
                disabled={loading || error !== null}
                onClick={() => {
                  setSaved(false)
                  setEditing('new')
                }}
              >
                <Typography variant="16/regular" color="white">
                  کارمند جدید
                </Typography>
              </Button>
            )}
          </div>
          {loading ? (
            <Typography role="status" variant="16/regular">
              در حال دریافت اطلاعات...
            </Typography>
          ) : error !== null ? (
            <RequestError error={error} returnTo="/dashboard/employees" retry={refresh} />
          ) : (
            <div className={`${cardClass} overflow-x-auto`}>
              <table className="w-full min-w-[600px] text-right">
                <thead>
                  <tr className="h-11 border-b border-neutral-200">
                    {['نام کارمند', 'نقش', 'وضعیت', ...(canManage ? ['عملیات'] : [])].map(
                      (label) => (
                        <th className="px-4" key={label}>
                          <Typography variant="14/semibold">{label}</Typography>
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {people
                    .filter((person) =>
                      `${person.name ?? ''} ${person.phone ?? ''} ${person.operationalRole ? OPERATIONAL_ROLE_LABELS[person.operationalRole] : ''}`.includes(
                        query,
                      ),
                    )
                    .map((person) => (
                      <tr
                        key={person.id}
                        className="h-[72px] border-b border-neutral-100 last:border-0"
                      >
                        <td className="px-4">
                          <Typography variant="14/regular">{person.name || 'بدون نام'}</Typography>
                        </td>
                        <td className="px-4">
                          <Typography variant="14/regular">
                            {person.operationalRole
                              ? OPERATIONAL_ROLE_LABELS[person.operationalRole]
                              : 'بدون نقش'}
                          </Typography>
                        </td>
                        <td className="px-4">
                          <Typography variant="14/regular">
                            {person.isActive ? 'فعال' : 'غیرفعال'}
                          </Typography>
                        </td>
                        {canManage && (
                          <td className="px-4">
                            <Button
                              variant="text"
                              aria-label={`ویرایش ${person.name ?? person.id}`}
                              onClick={() => {
                                setSaved(false)
                                setEditing(person)
                              }}
                            >
                              <Typography variant="14/regular">ویرایش</Typography>
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
              {people.length === 0 && (
                <Typography variant="16/regular" className="py-12 text-center">
                  هنوز کارمندی ثبت نشده است.
                </Typography>
              )}
              {people.length > 0 &&
                !people.some((person) =>
                  `${person.name ?? ''} ${person.phone ?? ''} ${person.operationalRole ? OPERATIONAL_ROLE_LABELS[person.operationalRole] : ''}`.includes(
                    query,
                  ),
                ) && (
                  <Typography variant="14/regular" className="py-12 text-center">
                    نتیجه‌ای یافت نشد.
                  </Typography>
                )}
            </div>
          )}
        </>
      )}
    </main>
  )
}
