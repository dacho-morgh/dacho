// Moved verbatim from dashboard/router.ts (S0, #238); keep route order within this file.
import type { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { DossierValidationError, dossierOfCompany, missingDossierItems, mergeDossier, pickDossierUpdate } from '../dossier.js'
import { changesAddress, changesCompany, COMPANY_EDIT_REVERIFICATION_REASON } from '../company-edits.js'
import { actorOf } from '../proxy-auth.js'
import { dashboardSelfProfile } from '../self-profile.js'
import { isRepresentative } from './route-helpers.js'
import type { DashboardContext } from './context.js'

export function registerProfileRoutes(router: Router, ctx: DashboardContext): void {
  const { deps, profileRepo, dossierDocuments, verificationStore } = ctx

  router.get('/profile', async (_req, res) => {
    const actor = actorOf(res)
    const profile = await profileRepo.getProfile(actor.id)
    res.json(profile)
  })

  router.get('/profile/me', (_req, res) => {
    const actor = actorOf(res)
    res.set('Cache-Control', 'private, no-store, max-age=0')
    res.json(dashboardSelfProfile(actor.user, actor.operationalRole))
  })

  router.patch('/profile', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const { company, contacts } = req.body ?? {}
    let profile = await profileRepo.getProfile(actor.id)
    const initialProfile = profile
    if (company?.nationalId !== undefined && company.nationalId !== profile.company.nationalId) {
      res.status(403).json({ error: 'protected_company_identity' })
      return
    }
    let dossierUpdate
    try {
      dossierUpdate = pickDossierUpdate(req.body?.dossier ?? req.body)
      mergeDossier(profile.dossier, dossierUpdate)
    } catch (error) {
      if (error instanceof DossierValidationError) {
        res.status(400).json({ error: error.code })
        return
      }
      throw error
    }

    // T59: any real company edit withdraws the approval. Invalidate before any
    // external write: a later contact/storage failure must not leave the
    // changed company eligible under the old approval.
    const companyEdited = changesCompany(initialProfile, {
      company: company && typeof company === 'object' ? company : undefined,
      executives: Array.isArray(req.body?.executives) ? req.body.executives : undefined,
      dossier: dossierUpdate,
    })
    if (companyEdited && initialProfile.companyId) {
      await verificationStore.invalidateApproval(initialProfile.companyId, COMPANY_EDIT_REVERIFICATION_REASON)
    }
    // Write the dossier first: its merge validation is the only 400-producing
    // part of this combined PATCH, so a rejected request must not leave the
    // company, contacts or executives partially updated.
    if (Object.keys(dossierUpdate).length > 0) {
      try {
        profile = await profileRepo.updateDossier(actor.id, dossierUpdate)
      } catch (error) {
        if (error instanceof DossierValidationError) {
          res.status(400).json({ error: error.code })
          return
        }
        throw error
      }
    }
    if (company && typeof company === 'object') {
      profile = await profileRepo.updateBasicInfo(actor.id, company)
    }
    if (contacts && typeof contacts === 'object') {
      profile = await profileRepo.updateContactInfo(actor.id, contacts)
    }
    if (Array.isArray(req.body?.executives)) {
      profile = await profileRepo.updateExecutives(actor.id, req.body.executives)
    }
    res.json(profile)
    } catch (error) { next(error) }
  })

  router.get('/profile/dossier', async (_req, res, next) => {
    try {
      const actor = actorOf(res)
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const dossier = dossierOfCompany(company)
      const documents = await dossierDocuments.listCompanyDocuments(company.id)
      const currentVerif = await verificationStore.findCurrentByCompanyId(company.id)
      res.json({
        dossier,
        documents,
        missing: missingDossierItems(company, dossier, documents),
        verification: currentVerif
          ? {
              id: currentVerif.id,
              status: currentVerif.status,
              revision: currentVerif.revision,
              submittedAt: currentVerif.submittedAt,
              decidedAt: currentVerif.decidedAt,
              reviewerId: currentVerif.reviewerId,
              reason: currentVerif.reason,
            }
          : { status: 'unsubmitted', revision: 0 },
      })
    } catch (error) { next(error) }
  })

  router.patch('/profile/dossier', async (req, res, next) => {
    try {
    const actor = actorOf(res)
    const currentProfile = await profileRepo.getProfile(actor.id)
    let update
    try {
      update = pickDossierUpdate(req.body?.dossier ?? req.body)
      mergeDossier(currentProfile.dossier, update)
    } catch (error) {
      if (error instanceof DossierValidationError) {
        res.status(400).json({ error: error.code })
        return
      }
      throw error
    }
    if (changesCompany(currentProfile, { dossier: update }) && currentProfile.companyId) {
      await verificationStore.invalidateApproval(currentProfile.companyId, COMPANY_EDIT_REVERIFICATION_REASON)
    }
    let profile
    try {
      profile = await profileRepo.updateDossier(actor.id, update)
    } catch (error) {
      if (error instanceof DossierValidationError) {
        res.status(400).json({ error: error.code })
        return
      }
      throw error
    }
    const company = await deps.companyStore.findByRepresentative(actor.id)
    if (!company) {
      res.status(404).json({ error: 'company_not_found' })
      return
    }
    const documents = await dossierDocuments.listCompanyDocuments(company.id)
    res.json({
      dossier: profile.dossier,
      documents,
      missing: missingDossierItems(company, profile.dossier, documents),
    })
    } catch (error) { next(error) }
  })

  router.post('/profile/verification/invalidate', async (req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isRepresentative(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() !== ''
        ? req.body.reason.trim()
        : 'درخواست احراز مجدد'
      const invalidated = await verificationStore.invalidateApproval(company.id, reason)
      res.json({ invalidated })
    } catch (error) { next(error) }
  })

  router.post('/profile/addresses', async (req, res) => {
    const actor = actorOf(res)
    const { title, province, city, postalCode, address } = req.body ?? {}
    if (!title || !address) {
      res.status(400).json({ error: 'invalid_address' })
      return
    }
    const { companyId } = await profileRepo.getProfile(actor.id)
    if (companyId) await verificationStore.invalidateApproval(companyId, COMPANY_EDIT_REVERIFICATION_REASON)
    const created = await profileRepo.addAddress(actor.id, {
      title: String(title),
      province: String(province ?? ''),
      city: String(city ?? ''),
      postalCode: String(postalCode ?? ''),
      address: String(address),
    })
    res.status(201).json({ address: created })
  })

  router.put('/profile/addresses/:id', async (req, res) => {
    const actor = actorOf(res)
    const { title, province, city, postalCode, address } = req.body ?? {}
    const update = {
      ...(title !== undefined ? { title: String(title) } : {}),
      ...(province !== undefined ? { province: String(province) } : {}),
      ...(city !== undefined ? { city: String(city) } : {}),
      ...(postalCode !== undefined ? { postalCode: String(postalCode) } : {}),
      ...(address !== undefined ? { address: String(address) } : {}),
    }
    const profile = await profileRepo.getProfile(actor.id)
    const current = profile.addresses.find((item) => item.id === req.params.id)
    if (current && profile.companyId && changesAddress(current, update)) {
      await verificationStore.invalidateApproval(profile.companyId, COMPANY_EDIT_REVERIFICATION_REASON)
    }
    const updated = await profileRepo.updateAddress(actor.id, req.params.id, update)
    if (!updated) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ address: updated })
  })

  router.delete('/profile/addresses/:id', async (req, res) => {
    const actor = actorOf(res)
    const profile = await profileRepo.getProfile(actor.id)
    if (profile.companyId && profile.addresses.some((item) => item.id === req.params.id)) {
      await verificationStore.invalidateApproval(profile.companyId, COMPANY_EDIT_REVERIFICATION_REASON)
    }
    const success = await profileRepo.deleteAddress(actor.id, req.params.id)
    if (!success) {
      res.status(404).json({ error: 'not_found' })
      return
    }
    res.json({ success: true })
  })

  router.get('/profile/verification', async (_req, res, next) => {
    try {
      const actor = actorOf(res)
      if (!isRepresentative(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const current = await verificationStore.findCurrentByCompanyId(company.id)
      const history = await verificationStore.listHistory(company.id)
      const dossier = dossierOfCompany(company)
      const documents = await dossierDocuments.listCompanyDocuments(company.id)
      const missing = missingDossierItems(company, dossier, documents)
      const canRequestVerification =
        missing.canRequestVerification &&
        current?.status !== 'pending' &&
        current?.status !== 'approved'
      res.json({
        status: current?.status ?? 'unsubmitted',
        revision: current?.revision ?? 0,
        submittedAt: current?.submittedAt ?? null,
        decidedAt: current?.decidedAt ?? null,
        reviewerId: current?.reviewerId ?? null,
        reason: current?.reason ?? null,
        canRequestVerification,
        history,
      })
    } catch (error) { next(error) }
  })

  const submitVerification = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = actorOf(res)
      if (!isRepresentative(actor.operationalRole)) {
        res.status(403).json({ error: 'forbidden' })
        return
      }
      const company = await deps.companyStore.findByRepresentative(actor.id)
      if (!company) {
        res.status(404).json({ error: 'company_not_found' })
        return
      }
      const dossier = dossierOfCompany(company)
      const documents = await dossierDocuments.listCompanyDocuments(company.id)
      const missing = missingDossierItems(company, dossier, documents)
      if (!missing.canRequestVerification) {
        res.status(400).json({ error: 'incomplete_dossier', missing: missing.required })
        return
      }
      const profile = await profileRepo.getProfile(actor.id)
      const snapshot = {
        company: { ...profile.company, province: company.province ?? '', city: company.city ?? '' },
        dossier: profile.dossier,
        addresses: profile.addresses,
        executives: profile.executives,
        documents: documents.map((doc) => ({
          id: doc.id,
          category: doc.category,
          filename: doc.filename,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
        })),
        representative: {
          id: actor.id,
          name: actor.user.name ?? null,
          phone: actor.user.phone,
          email: actor.user.email ?? null,
        },
      }
      const result = await verificationStore.submit({
        companyId: company.id,
        representativeId: actor.id,
        snapshot,
      })
      if (!result.ok) {
        if (result.reason === 'already_submitted') {
          res.status(409).json({ error: 'already_submitted' })
          return
        }
        res.status(409).json({ error: 'already_approved' })
        return
      }
      res.status(201).json({ verification: result.verification })
    } catch (error) { next(error) }
  }

  router.post('/profile/verification/submit', submitVerification)
  router.post('/profile/verification', submitVerification)
}
