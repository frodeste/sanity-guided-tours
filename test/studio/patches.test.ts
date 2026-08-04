import {describe, expect, test} from 'bun:test'

import {insert, set, setIfMissing, unset} from 'sanity'
import type {FormInsertPatch} from 'sanity'

import {
  duplicateStepPatch,
  insertChapterPatch,
  insertElementPatch,
  insertStepPatch,
  moveElementPatch,
  moveStepPatch,
  removeElementPatch,
  removeStepPatch,
  setElementWidthPatch,
  setStepFieldPatch,
} from '../../src/studio/patches'

// All patch builders return plain FormPatch objects built via `set`/`unset`/
// `insert`/`setIfMissing` from 'sanity' — the same constructors we use here
// to build the expected values, so the assertions are grounded in the real
// runtime shape rather than a hand-rolled guess at it.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isInsertPatch(patch: unknown): patch is FormInsertPatch {
  return isRecord(patch) && patch.type === 'insert' && Array.isArray(patch.items)
}

function collectKeys(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, acc)
    return acc
  }
  if (isRecord(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (k === '_key' && typeof v === 'string') acc.push(v)
      collectKeys(v, acc)
    }
  }
  return acc
}

describe('insertElementPatch', () => {
  test('appends the element into a possibly-missing/empty elements array', () => {
    const element = {_type: 'hotspot', _key: 'el1', x: 10, y: 20}
    const patches = insertElementPatch('ch1', 'st1', element)

    expect(patches).toEqual([
      setIfMissing([], [{_key: 'ch1'}, 'steps', {_key: 'st1'}, 'elements']),
      insert([element], 'after', [{_key: 'ch1'}, 'steps', {_key: 'st1'}, 'elements', -1]),
    ])
  })
})

describe('moveElementPatch', () => {
  test('desktop sets x and y directly', () => {
    const patches = moveElementPatch('ch1', 'st1', 'el1', {x: 12.5, y: 40}, 'desktop')

    expect(patches).toEqual([
      set(12.5, [{_key: 'ch1'}, 'steps', {_key: 'st1'}, 'elements', {_key: 'el1'}, 'x']),
      set(40, [{_key: 'ch1'}, 'steps', {_key: 'st1'}, 'elements', {_key: 'el1'}, 'y']),
    ])
  })

  test('mobile creates the mobile object before setting its members', () => {
    const patches = moveElementPatch('ch1', 'st1', 'el1', {x: 12.5, y: 40}, 'mobile')

    expect(patches).toEqual([
      setIfMissing({}, [
        {_key: 'ch1'},
        'steps',
        {_key: 'st1'},
        'elements',
        {_key: 'el1'},
        'mobile',
      ]),
      set(12.5, [{_key: 'ch1'}, 'steps', {_key: 'st1'}, 'elements', {_key: 'el1'}, 'mobile', 'x']),
      set(40, [{_key: 'ch1'}, 'steps', {_key: 'st1'}, 'elements', {_key: 'el1'}, 'mobile', 'y']),
    ])
  })
})

describe('setElementWidthPatch', () => {
  test('desktop sets width directly', () => {
    const patches = setElementWidthPatch('ch1', 'st1', 'el1', 300, 'desktop')

    expect(patches).toEqual([
      set(300, [{_key: 'ch1'}, 'steps', {_key: 'st1'}, 'elements', {_key: 'el1'}, 'width']),
    ])
  })

  test('mobile creates the mobile object before setting width', () => {
    const patches = setElementWidthPatch('ch1', 'st1', 'el1', 200, 'mobile')

    expect(patches).toEqual([
      setIfMissing({}, [
        {_key: 'ch1'},
        'steps',
        {_key: 'st1'},
        'elements',
        {_key: 'el1'},
        'mobile',
      ]),
      set(200, [
        {_key: 'ch1'},
        'steps',
        {_key: 'st1'},
        'elements',
        {_key: 'el1'},
        'mobile',
        'width',
      ]),
    ])
  })
})

describe('removeElementPatch', () => {
  test('unsets the keyed element', () => {
    const patches = removeElementPatch('ch1', 'st1', 'el1')

    expect(patches).toEqual([
      unset([{_key: 'ch1'}, 'steps', {_key: 'st1'}, 'elements', {_key: 'el1'}]),
    ])
  })
})

describe('insertStepPatch', () => {
  test('inserts after a given step key', () => {
    const step = {_type: 'guidedTourStep', _key: 'newstep', title: 'New'}
    const patches = insertStepPatch('ch1', step, 'st1')

    expect(patches).toEqual([insert([step], 'after', [{_key: 'ch1'}, 'steps', {_key: 'st1'}])])
  })

  test('null afterStepKey appends into a possibly-empty steps array', () => {
    const step = {_type: 'guidedTourStep', _key: 'newstep', title: 'New'}
    const patches = insertStepPatch('ch1', step, null)

    expect(patches).toEqual([
      setIfMissing([], [{_key: 'ch1'}, 'steps']),
      insert([step], 'after', [{_key: 'ch1'}, 'steps', -1]),
    ])
  })
})

describe('duplicateStepPatch', () => {
  const sourceStep = {
    _type: 'guidedTourStep',
    _key: 'srcstep',
    title: 'Original',
    elements: [
      {
        _type: 'tooltip',
        _key: 'srcel1',
        x: 10,
        y: 20,
        content: [
          {
            _type: 'block',
            _key: 'srcblock1',
            children: [{_type: 'span', _key: 'srcspan1', text: 'hi', marks: []}],
          },
        ],
      },
      {_type: 'hotspot', _key: 'srcel2', x: 30, y: 40},
    ],
  }

  test('inserts the duplicate right after the source step', () => {
    let n = 0
    const patches = duplicateStepPatch('ch1', sourceStep, 'newstep', () => `gen${n++}`)

    expect(patches).toHaveLength(1)
    const patch = patches[0]
    expect(patch).toEqual(
      insert(
        [
          {
            _type: 'guidedTourStep',
            _key: 'newstep',
            title: 'Original',
            elements: [
              {
                _type: 'tooltip',
                _key: 'gen0',
                x: 10,
                y: 20,
                content: [
                  {
                    _type: 'block',
                    _key: 'gen1',
                    children: [{_type: 'span', _key: 'gen2', text: 'hi', marks: []}],
                  },
                ],
              },
              {_type: 'hotspot', _key: 'gen3', x: 30, y: 40},
            ],
          },
        ],
        'after',
        [{_key: 'ch1'}, 'steps', {_key: 'srcstep'}],
      ),
    )
  })

  test('no source _key survives anywhere in the duplicated step', () => {
    const patches = duplicateStepPatch('ch1', sourceStep, 'newstep', () => `gen${Math.random()}`)
    const sourceKeys = collectKeys(sourceStep)
    const insertPatch = patches[0]
    if (!isInsertPatch(insertPatch)) throw new Error('expected an insert patch')
    const duplicatedKeys = collectKeys(insertPatch.items[0])

    for (const key of duplicatedKeys) {
      expect(sourceKeys).not.toContain(key)
    }
  })

  test('regenerates every key with a fresh value from the generator, including the step key', () => {
    const seen = new Set<string>()
    let n = 0
    const patches = duplicateStepPatch('ch1', sourceStep, 'newstep', () => {
      const key = `gen${n++}`
      seen.add(key)
      return key
    })
    const insertPatch = patches[0]
    if (!isInsertPatch(insertPatch)) throw new Error('expected an insert patch')
    const duplicatedKeys = collectKeys(insertPatch.items[0])

    // step's own _key came from newKey, not the generator — every other key
    // (4 of them: 2 elements + 1 block + 1 span) must be unique gen* values.
    expect(duplicatedKeys.filter((k) => k !== 'newstep')).toHaveLength(4)
    expect(new Set(duplicatedKeys.filter((k) => k !== 'newstep')).size).toBe(4)
  })
})

describe('removeStepPatch', () => {
  test('unsets the keyed step', () => {
    const patches = removeStepPatch('ch1', 'st1')

    expect(patches).toEqual([unset([{_key: 'ch1'}, 'steps', {_key: 'st1'}])])
  })
})

describe('moveStepPatch', () => {
  const step = {_type: 'guidedTourStep', _key: 'st1', title: 'Moving', elements: []}

  test('removes from source and inserts into target after a given key, preserving _keys', () => {
    const patches = moveStepPatch('ch1', 'st1', step, 'ch2', 'st9')

    expect(patches).toEqual([
      unset([{_key: 'ch1'}, 'steps', {_key: 'st1'}]),
      insert([step], 'after', [{_key: 'ch2'}, 'steps', {_key: 'st9'}]),
    ])
  })

  test('null afterStepKey appends into a possibly-empty target steps array', () => {
    const patches = moveStepPatch('ch1', 'st1', step, 'ch2', null)

    expect(patches).toEqual([
      unset([{_key: 'ch1'}, 'steps', {_key: 'st1'}]),
      setIfMissing([], [{_key: 'ch2'}, 'steps']),
      insert([step], 'after', [{_key: 'ch2'}, 'steps', -1]),
    ])
  })

  test('cross-chapter move keeps the step object (and its element keys) byte-identical', () => {
    const stepWithElements = {
      _type: 'guidedTourStep',
      _key: 'st1',
      elements: [{_type: 'hotspot', _key: 'el1', x: 1, y: 2}],
    }
    const patches = moveStepPatch('ch1', 'st1', stepWithElements, 'ch2', null)
    const insertPatch = patches[2]
    if (!isInsertPatch(insertPatch)) throw new Error('expected an insert patch')

    expect(insertPatch.items[0]).toEqual(stepWithElements)
  })
})

describe('insertChapterPatch', () => {
  test('inserts after a given chapter key', () => {
    const chapter = {_type: 'guidedTourChapter', _key: 'newch', title: 'New chapter'}
    const patches = insertChapterPatch(chapter, 'ch1')

    expect(patches).toEqual([insert([chapter], 'after', [{_key: 'ch1'}])])
  })

  test('null afterChapterKey appends into a possibly-empty chapters array', () => {
    const chapter = {_type: 'guidedTourChapter', _key: 'newch', title: 'New chapter'}
    const patches = insertChapterPatch(chapter, null)

    expect(patches).toEqual([setIfMissing([], []), insert([chapter], 'after', [-1])])
  })
})

describe('setStepFieldPatch', () => {
  test('sets a scalar field on the keyed step', () => {
    const patches = setStepFieldPatch('ch1', 'st1', 'title', 'New title')

    expect(patches).toEqual([set('New title', [{_key: 'ch1'}, 'steps', {_key: 'st1'}, 'title'])])
  })
})
