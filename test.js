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
  await t.test('should support directives (text)', async function () {
    assert.deepEqual(
      fromMarkdown('a :b[c]{d} e.', {
        extensions: [directive()],
        mdastExtensions: [directiveFromMarkdown()]
      }).children[0],
      {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            value: 'a ',
            position: {
              start: {line: 1, column: 1, offset: 0},
              end: {line: 1, column: 3, offset: 2}
            }
          },
          {
            type: 'textDirective',
            name: 'b',
            attributes: {d: ''},
            children: [
              {
                type: 'text',
                value: 'c',
                position: {
                  start: {line: 1, column: 6, offset: 5},
                  end: {line: 1, column: 7, offset: 6}
                }
              }
            ],
            position: {
              start: {line: 1, column: 3, offset: 2},
              end: {line: 1, column: 11, offset: 10}
            }
          },
          {
            type: 'text',
            value: ' e.',
            position: {
              start: {line: 1, column: 11, offset: 10},
              end: {line: 1, column: 14, offset: 13}
            }
          }
        ],
        position: {
          start: {line: 1, column: 1, offset: 0},
          end: {line: 1, column: 14, offset: 13}
        }
      }
    )
  })

  await t.test('should support directives (leaf)', async function () {
    assert.deepEqual(
      fromMarkdown('::a[b]{c}', {
        extensions: [directive()],
        mdastExtensions: [directiveFromMarkdown()]
      }).children[0],
      {
        type: 'leafDirective',
        name: 'a',
        attributes: {c: ''},
        children: [
          {
            type: 'text',
            value: 'b',
            position: {
              start: {line: 1, column: 5, offset: 4},
              end: {line: 1, column: 6, offset: 5}
            }
          }
        ],
        position: {
          start: {line: 1, column: 1, offset: 0},
          end: {line: 1, column: 10, offset: 9}
        }
      }
    )
  })

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

  await t.test('should support content in a label', async function () {
    const tree = fromMarkdown(':a[b *c*\nd]', {
      extensions: [directive()],
      mdastExtensions: [directiveFromMarkdown()]
    })

    removePosition(tree, {force: true})

    assert.deepEqual(tree, {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'textDirective',
              name: 'a',
              attributes: {},
              children: [
                {type: 'text', value: 'b '},
                {type: 'emphasis', children: [{type: 'text', value: 'c'}]},
                {type: 'text', value: '\nd'}
              ]
            }
          ]
        }
      ]
    })
  })

  await t.test('should support attributes', async function () {
    const tree = fromMarkdown(':a{#b.c.d e=f g="h&amp;i&unknown;j"}', {
      extensions: [directive()],
      mdastExtensions: [directiveFromMarkdown()]
    })

    removePosition(tree, {force: true})

    assert.deepEqual(tree, {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'textDirective',
              name: 'a',
              attributes: {id: 'b', class: 'c d', e: 'f', g: 'h&i&unknown;j'},
              children: []
            }
          ]
        }
      ]
    })
  })

  await t.test(
    'should not support non-terminated character references',
    async function () {
      const tree = fromMarkdown(':a{b=&param c="&param" d=\'&param\'}', {
        extensions: [directive()],
        mdastExtensions: [directiveFromMarkdown()]
      })

      removePosition(tree, {force: true})

      assert.deepEqual(tree, {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'textDirective',
                name: 'a',
                attributes: {b: '&param', c: '&param', d: '&param'},
                children: []
              }
            ]
          }
        ]
      })
    }
  )

  await t.test('should support EOLs in attributes', async function () {
    const tree = fromMarkdown(':a{b\nc="d\ne"}', {
      extensions: [directive()],
      mdastExtensions: [directiveFromMarkdown()]
    })

    removePosition(tree, {force: true})

    assert.deepEqual(tree, {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'textDirective',
              name: 'a',
              attributes: {b: '', c: 'd\ne'},
              children: []
            }
          ]
        }
      ]
    })
  })

  await t.test('should support directives in directives', async function () {
    const tree = fromMarkdown('::::a\n:::b\n:c\n:::\n::::', {
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
              children: [
                {
                  type: 'paragraph',
                  children: [
                    {
                      type: 'textDirective',
                      name: 'c',
                      attributes: {},
                      children: []
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    })
  })
})

test('directiveToMarkdown()', async function (t) {
  await t.test(
    'should try to serialize a directive (text) w/o `name`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [
              {type: 'text', value: 'a '},
              // @ts-expect-error: check how the runtime handles `children`, `name` missing.
              {type: 'textDirective'},
              {type: 'text', value: ' b.'}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a : b.\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (text) w/ `name`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [
              {type: 'text', value: 'a '},
              // @ts-expect-error: check how the runtime handles `children` missing.
              {type: 'textDirective', name: 'b'},
              {type: 'text', value: ' c.'}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a :b c.\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (text) w/ `children`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [
              {type: 'text', value: 'a '},
              {
                type: 'textDirective',
                name: 'b',
                children: [{type: 'text', value: 'c'}]
              },
              {type: 'text', value: ' d.'}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a :b[c] d.\n'
      )
    }
  )

  await t.test(
    'should escape brackets in a directive (text) label',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [
              {type: 'text', value: 'a '},
              {
                type: 'textDirective',
                name: 'b',
                children: [{type: 'text', value: 'c[d]e'}]
              },
              {type: 'text', value: ' f.'}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a :b[c\\[d\\]e] f.\n'
      )
    }
  )

  await t.test(
    'should support EOLs in a directive (text) label',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [
              {type: 'text', value: 'a '},
              {
                type: 'textDirective',
                name: 'b',
                children: [{type: 'text', value: 'c\nd'}]
              },
              {type: 'text', value: ' e.'}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a :b[c\nd] e.\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (text) w/ `attributes`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [
              {type: 'text', value: 'a '},
              {
                type: 'textDirective',
                name: 'b',
                attributes: {
                  c: 'd',
                  e: 'f',
                  g: '',
                  h: null,
                  i: undefined,
                  // @ts-expect-error: check how the runtime handles `number`s
                  j: 2
                },
                children: []
              },
              {type: 'text', value: ' k.'}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a :b{c="d" e="f" g j="2"} k.\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (text) w/ `id`, `class` attributes',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [
              {type: 'text', value: 'a '},
              {
                type: 'textDirective',
                name: 'b',
                attributes: {class: 'a b\nc', id: 'd', key: 'value'},
                children: []
              },
              {type: 'text', value: ' k.'}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a :b{#d .a.b.c key="value"} k.\n'
      )
    }
  )

  await t.test(
    'should encode the quote in an attribute value (text)',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [
              {type: 'text', value: 'a '},
              {
                type: 'textDirective',
                name: 'b',
                attributes: {x: 'y"\'\r\nz'},
                children: []
              },
              {type: 'text', value: ' k.'}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a :b{x="y&#x22;\'\r\nz"} k.\n'
      )
    }
  )

  await t.test(
    'should encode the quote in an attribute value (text)',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [
              {type: 'text', value: 'a '},
              {
                type: 'textDirective',
                name: 'b',
                attributes: {x: 'y"\'\r\nz'},
                children: []
              },
              {type: 'text', value: ' k.'}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a :b{x="y&#x22;\'\r\nz"} k.\n'
      )
    }
  )

  await t.test(
    'should not use the `id` shortcut if impossible characters exist',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [
              {type: 'text', value: 'a '},
              {
                type: 'textDirective',
                name: 'b',
                attributes: {id: 'c#d'},
                children: []
              },
              {type: 'text', value: ' e.'}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a :b{id="c#d"} e.\n'
      )
    }
  )

  await t.test(
    'should not use the `class` shortcut if impossible characters exist',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [
              {type: 'text', value: 'a '},
              {
                type: 'textDirective',
                name: 'b',
                attributes: {class: 'c.d e<f'},
                children: []
              },
              {type: 'text', value: ' g.'}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a :b{class="c.d e<f"} g.\n'
      )
    }
  )

  await t.test(
    'should not use the `class` shortcut if impossible characters exist (but should use it for classes that don’t)',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'paragraph',
            children: [
              {type: 'text', value: 'a '},
              {
                type: 'textDirective',
                name: 'b',
                attributes: {class: 'c.d e f<g hij'},
                children: []
              },
              {type: 'text', value: ' k.'}
            ]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        'a :b{.e.hij class="c.d f<g"} k.\n'
      )
    }
  )

  await t.test(
    'should try to serialize a directive (leaf) w/o `name`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          // @ts-expect-error: check how the runtime handles `children`, `name` missing.
          {type: 'leafDirective'},
          {extensions: [directiveToMarkdown()]}
        ),
        '::\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (leaf) w/ `name`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          // @ts-expect-error: check how the runtime handles `children` missing.
          {type: 'leafDirective', name: 'a'},
          {extensions: [directiveToMarkdown()]}
        ),
        '::a\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (leaf) w/ `children`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'leafDirective',
            name: 'a',
            children: [{type: 'text', value: 'b'}]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        '::a[b]\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (leaf) w/ `children`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'leafDirective',
            name: 'a',
            children: [{type: 'text', value: 'b'}]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        '::a[b]\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (leaf) w/ EOLs in `children`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'leafDirective',
            name: 'a',
            children: [{type: 'text', value: 'b\nc'}]
          },
          {extensions: [directiveToMarkdown()]}
        ),
        '::a[b&#xA;c]\n'
      )
    }
  )

  await t.test(
    'should serialize a directive (leaf) w/ EOLs in `attributes`',
    async function () {
      assert.deepEqual(
        toMarkdown(
          {
            type: 'leafDirective',
            name: 'a',
            attributes: {id: 'b', class: 'c d', key: 'e\nf'},
            children: []
          },
          {extensions: [directiveToMarkdown()]}
        ),
        '::a{#b .c.d key="e&#xA;f"}\n'
      )
    }
  )

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

  await t.test('should escape a `:` after a text directive', async function () {
    assert.deepEqual(
      toMarkdown(
        {
          type: 'paragraph',
          children: [
            {type: 'textDirective', name: 'red', children: []},
            {type: 'text', value: ':'}
          ]
        },
        {extensions: [directiveToMarkdown()]}
      ),
      ':red:\n'
    )
  })
})
