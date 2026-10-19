import { afterEach, describe, expect, it, vi } from 'vitest'
import { announceBeacon, announceChange, onChange } from '../../server/utils/changes'

afterEach(() => vi.useRealTimers())

describe('live changes', () => {
  it('tell every listener at once about a change in the settings', () => {
    const heard = vi.fn()
    const stop = onChange(heard)
    announceChange()
    expect(heard).toHaveBeenCalledTimes(1)
    stop()
    announceChange()
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('pace beacons: a burst is one announcement a few seconds later', () => {
    vi.useFakeTimers()
    const heard = vi.fn()
    const stop = onChange(heard)
    for (let i = 0; i < 50; i++) announceBeacon()
    expect(heard).not.toHaveBeenCalled()
    vi.advanceTimersByTime(3000)
    expect(heard).toHaveBeenCalledTimes(1)
    announceBeacon()
    vi.advanceTimersByTime(3000)
    expect(heard).toHaveBeenCalledTimes(2)
    stop()
  })

  it('announce nothing while no dashboard is open', () => {
    vi.useFakeTimers()
    announceBeacon()
    const heard = vi.fn()
    const stop = onChange(heard)
    vi.advanceTimersByTime(3000)
    expect(heard).not.toHaveBeenCalled()
    stop()
  })
})
