// Sanity's schema validation builders receive a chainable `Rule` object
// (rule.required().min(0)) that only exists inside a running Studio. To test
// validation intent without a Studio, this spy stands in for `Rule`: every
// method call is recorded and returns the same spy, so any chain resolves
// without error and the calls can be inspected afterwards.

export interface RuleCall {
  method: string
  args: unknown[]
}

export interface RuleSpy {
  calls: RuleCall[]
}

export function createRuleSpy(): RuleSpy {
  const calls: RuleCall[] = []
  const target: RuleSpy = {calls}
  const spy = new Proxy(target, {
    get(_target, prop) {
      if (prop === 'calls') return calls
      return (...args: unknown[]) => {
        calls.push({method: String(prop), args})
        return spy
      }
    },
  })
  return spy
}

/** Invokes a field's `validation` builder with a fresh rule spy and returns it. */
export function runValidation(validation: unknown, context?: unknown): RuleSpy {
  const spy = createRuleSpy()
  if (typeof validation === 'function') {
    Reflect.apply(validation, undefined, [spy, context])
  }
  return spy
}

export function methodNames(spy: RuleSpy): string[] {
  return spy.calls.map((call) => call.method)
}

export function findCall(spy: RuleSpy, method: string): RuleCall | undefined {
  return spy.calls.find((call) => call.method === method)
}

/** Extracts the function passed to `rule.custom(fn)` so it can be called directly. */
export function customValidator(spy: RuleSpy): (value: unknown, context?: unknown) => unknown {
  const call = findCall(spy, 'custom')
  if (!call) throw new Error('rule.custom() was not called')
  const fn = call.args[0]
  if (typeof fn !== 'function') throw new Error('rule.custom() argument is not a function')
  return (value, context) => Reflect.apply(fn, undefined, [value, context])
}
