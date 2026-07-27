import { describe, expect, it } from 'vitest'
import { RequestGate } from './requestGate'

describe('RequestGate', () => {
  it('hızlı gezinmede eski isteğin yeni görünümü ezmesini engeller', () => {
    const gate = new RequestGate()
    const oldWeek = gate.next()
    const newWeek = gate.next()
    expect(gate.isCurrent(oldWeek)).toBe(false)
    expect(gate.isCurrent(newWeek)).toBe(true)
  })
})
