import type { OtpDelivery } from './delivery.js'

/** Dev/stub delivery: logs the code and remembers the last one per phone. */
export class ConsoleOtpDelivery implements OtpDelivery {
  private readonly last = new Map<string, string>()

  async send(phone: string, code: string): Promise<void> {
    this.last.set(phone, code)
    console.log(`[otp] code for ${phone}: ${code}`)
  }

  lastCodeFor(phone: string): string | undefined {
    return this.last.get(phone)
  }
}
