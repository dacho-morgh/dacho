export interface WorkflowStep {
  title: string
  /** The assigned role's id (role-gating compares actor roles against this). */
  role: string
  /** The assigned role's display name (denormalized for `assigned_role`). */
  roleName: string
  order: number
}

export interface FormField {
  name: string
  blockType: string
  label?: string
  required?: boolean
}

export interface ServiceDefinition {
  id: string
  key: string
  title: string
  workflow: WorkflowStep[]
  /** Form-builder field blocks from the attached form; null when no form is linked. */
  formFields: FormField[] | null
}

/** Reads CMS-owned service definitions (key, workflow, form schema) the backend needs. */
export interface ServiceCatalog {
  findById(id: string): Promise<ServiceDefinition | undefined>
}

/** In-memory stand-in; the real implementation reads Payload via REST. */
export class InMemoryServiceCatalog implements ServiceCatalog {
  private readonly services = new Map<string, ServiceDefinition>()

  constructor(services: ServiceDefinition[] = []) {
    for (const service of services) this.services.set(service.id, service)
  }

  set(service: ServiceDefinition): void {
    this.services.set(service.id, service)
  }

  async findById(id: string): Promise<ServiceDefinition | undefined> {
    return this.services.get(id)
  }
}
