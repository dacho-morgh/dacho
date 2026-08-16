import { InMemoryCodeStore } from '../src/otp/code-store.js'
import { describeCodeStore } from './code-store.shared.js'

describeCodeStore('InMemoryCodeStore', (opts) => new InMemoryCodeStore(opts), () => {})
