export interface OtpDelivery {
  send(phone: string, code: string): Promise<void>
}
