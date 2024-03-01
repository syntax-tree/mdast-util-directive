import assert from 'node:assert/strict'
import test from 'node:test'
import {directive} from 'micromark-extension-directive'
import {directiveFromMarkdown, directiveToMarkdown} from 'mdast-util-directive'
import {fromMarkdown} from 'mdast-util-from-markdown'
import {toMarkdown} from 'mdast-util-to-markdown'
import {removePosition} from 'unist-util-remove-position'

test('core', async function (t) {
  await t.test('should expose the public api', async function () {
    assert.deepEqual(Object.keys(await import('mdast-util-directive')).sort(), [
      'directiveFromMarkdown',
      'directiveToMarkdown'
    ])
  })
})

test('directiveFromMarkdown()', async function (t) {
  await t.test('should support directives (container)', async function () {
    assert.deepEqual(
      fromMarkdown(':::a[b]{c}\nd', {
        extensions: [directive()],
        mdastExtensions: [directiveFromMarkdown()]
      }).children[0],
      {
        type: 'containerDirective',
        name: 'a',
        attributes: {c: ''},
        children: [
          {
            type: 'paragraph',
            data: {directiveLabel: true},
            children: [
              {
                type: 'text',
                value: 'b',
                position: {
                  start: {line: 1, column: 6, offset: 5},
                  end: {line: 1, column: 7, offset: 6}
                }
              }
            ],
            position: {
              start: {line: 1, column: 5, offset: 4},
              end: {line: 1, column: 8, offset: 7}
            }
          },
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                value: 'd',
                position: {
                  start: {line: 2, column: 1, offset: 11},
                  end: {line: 2, column: 2, offset: 12}
                }
              }
            ],
            position: {
              start: {line: 2, column: 1, offset: 11},
              end: {line: 2, column: 2, offset: 12}
            }
          }
        ],
        position: {
          start: {line: 1, column: 1, offset: 0},
          end: {line: 2, column: 2, offset: 12}
        }
      }
    )
  })

  await t.test('should support directives in directives', async function () {
    const tree = fromMarkdown('::::a\n:::b\n:::\n::::', {
      extensions: [directive()],
      mdastExtensions: [directiveFromMarkdown()]
    })

    removePosition(tree, {force: true})

    assert.deepEqual(tree, {
      type: 'root',
      children: [
        {
          type: 'containerDirective',
          name: 'a',
          attributes: {},
          children: [
            {
              type: 'containerDirective',
              name: 'b',
              attributes: {},
              children: []
            }
          ]
        }
      ]
    })
  })
})

test('directiveToMarkdown()', async function (t) {
  await t.test(
    'should try to serialize a directive (container) w/o `name`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          // @ts-expect-error: check how the runtime handles `children`, `name` missing.
          {type: 'containerDirective'},
          {extensions: [directiveToMarkdown()]}
        ),
        ':::\n:::\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (container) w/ `name`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          // @ts-expect-error: check how the runtime handles `children` missing.
          {type: 'containerDirective', name: 'a'},
          {extensions: [directiveToMarkdown()]}
        ),
        ':::a\n:::\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (container) w/ `children`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'containerDirective',
            name: 'a',
            children: [
              {type: 'paragraph', children: [{type: 'text', value: 'b'}]}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        ':::a\nb\n:::\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (container) w/ `children` (heading)',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'containerDirective',
            name: 'a',
            children: [
              {
                type: 'heading',
                depth: 1,
                children: [{type: 'text', value: 'b'}]
              }
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        ':::a\n# b\n:::\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (container) w/ EOLs in `children`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'containerDirective',
            name: 'a',
            children: [
              {type: 'paragraph', children: [{type: 'text', value: 'b\nc'}]}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        ':::a\nb\nc\n:::\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (container) w/ EOLs in `attributes`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'containerDirective',
            name: 'a',
            attributes: {id: 'b', class: 'c d', key: 'e\nf'},
            children: []
          },
          {extensions: [directiveToMarkdown()]}
        ),
        ':::a{#b .c.d key="e&#xA;f"}\n:::\n'
      )
    }
  )

  await t.test(
    'should serialize the first paragraph w/ `data.directiveLabel` as a label in a directive (container)',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'containerDirective',
            name: 'a',
            children: [
              {
                type: 'paragraph',
                data: {directiveLabel: true},
                children: [{type: 'text', value: 'b'}]
              }
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        ':::a[b]\n:::\n'
      )
    }
  )

  await t.test(
    'should serialize the outer containers w/ more colons than inner containers',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'containerDirective',
            name: 'a',
            children: [
              {
                type: 'containerDirective',
                name: 'b',
                children: [
                  {
                    type: 'paragraph',
                    children: [{type: 'text', value: 'c'}]
                  }
                ]
              }
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        '::::a\n:::b\nc\n:::\n::::\n'
      )
    }
  )

  await t.test(
    'should serialize w/ `3 + nesting`, not the total count (1)',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'containerDirective',
            name: 'a',
            children: [
              {
                type: 'containerDirective',
                name: 'b',
                children: [
                  {
                    type: 'paragraph',
                    children: [{type: 'text', value: 'c'}]
                  }
                ]
              },
              {
                type: 'containerDirective',
                name: 'd',
                children: [
                  {
                    type: 'paragraph',
                    children: [{type: 'text', value: 'e'}]
                  }
                ]
              }
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        '::::a\n:::b\nc\n:::\n\n:::d\ne\n:::\n::::\n'
      )
    }
  )

  await t.test(
    'should serialize w/ `3 + nesting`, not the total count (2)',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'containerDirective',
            name: 'a',
            children: [
              {
                type: 'containerDirective',
                name: 'b',
                children: [
                  {
                    type: 'containerDirective',
                    name: 'c',
                    children: [
                      {
                        type: 'paragraph',
                        children: [{type: 'text', value: 'd'}]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        ':::::a\n::::b\n:::c\nd\n:::\n::::\n:::::\n'
      )
    }
  )

  await t.test(
    'should serialize w/ `3 + nesting`, not the total count (3)',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'containerDirective',
            name: 'a',
            children: [
              {
                type: 'blockquote',
                children: [
                  {
                    type: 'containerDirective',
                    name: 'b',
                    children: [
                      {
                        type: 'paragraph',
                        children: [{type: 'text', value: 'c'}]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        '::::a\n> :::b\n> c\n> :::\n::::\n'
      )
    }
  )

  await t.test(
    'should escape a `:` in phrasing when followed by an alpha',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [{type: 'text', value: 'a:b'}]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a\\:b\n'
      )
    }
  )

  await t.test(
    'should not escape a `:` in phrasing when followed by a non-alpha',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [{type: 'text', value: 'a:9'}]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a:9\n'
      )
    }
  )

  await t.test(
    'should not escape a `:` in phrasing when preceded by a colon',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [{type: 'text', value: 'a::c'}]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a::c\n'
      )
    }
  )

  await t.test('should not escape a `:` at a break', async function () {
    assert.deepEqual(
      toMarkdown(
        {
          type: 'paragraph',
          children: [{type: 'text', value: ':\na'}]
        },
        {extensions: [directiveToMarkdown()]}
      ),
      ':\na\n'
    )
  })

  await t.test(
    'should not escape a `:` at a break when followed by an alpha',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [{type: 'text', value: ':a'}]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        '\\:a\n'
      )
    }
  )

  await t.test(
    'should escape a `:` at a break when followed by a colon',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [{type: 'text', value: '::\na'}]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        '\\::\na\n'
      )
    }
  )

  await t.test(
    'should escape a `:` at a break when followed by two colons',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [{type: 'text', value: ':::\na'}]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        '\\:::\na\n'
      )
    }
  )

  await t.test(
    'should escape a `:` at a break when followed by two colons',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [{type: 'text', value: ':::\na'}]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        '\\:::\na\n'
      )
    }
  )
})
