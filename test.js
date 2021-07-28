import test from 'tape'
import {fromMarkdown} from 'mdast-util-from-markdown'
import {toMarkdown} from 'mdast-util-to-markdown'
import {removePosition} from 'unist-util-remove-position'
import {directive} from 'micromark-extension-directive'
import {directiveFromMarkdown, directiveToMarkdown} from './index.js'

test('markdown -> mdast', (t) => {
  t.deepEqual(
    fromMarkdown('a :b[c]{d} e.', {
      extensions: [directive()],
      mdastExtensions: [directiveFromMarkdown]
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
    },
    'should support directives (text)'
  )

  t.deepEqual(
    fromMarkdown('::a[b]{c}', {
      extensions: [directive()],
      mdastExtensions: [directiveFromMarkdown]
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
    },
    'should support directives (leaf)'
  )

  t.deepEqual(
    fromMarkdown(':::a[b]{c}\nd', {
      extensions: [directive()],
      mdastExtensions: [directiveFromMarkdown]
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
    },
    'should support directives (container)'
  )

  t.deepEqual(
    removePosition(
      fromMarkdown(':a[b *c*\nd]', {
        extensions: [directive()],
        mdastExtensions: [directiveFromMarkdown]
      }),
      true
    ),
    {
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
    },
    'should support content in a label'
  )

  t.deepEqual(
    removePosition(
      fromMarkdown(':a{#b.c.d e=f g="h&amp;i&unknown;j"}', {
        extensions: [directive()],
        mdastExtensions: [directiveFromMarkdown]
      }),
      true
    ),
    {
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
    },
    'should support attributes'
  )

  t.deepEqual(
    removePosition(
      fromMarkdown(':a{b\nc="d\ne"}', {
        extensions: [directive()],
        mdastExtensions: [directiveFromMarkdown]
      }),
      true
    ),
    {
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
    },
    'should support EOLs in attributes'
  )

  t.deepEqual(
    removePosition(
      fromMarkdown('::::a\n:::b\n:c\n:::\n::::', {
        extensions: [directive()],
        mdastExtensions: [directiveFromMarkdown]
      }),
      true
    ),
    {
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
    },
    'should support directives in directives'
  )

  t.end()
})

test('mdast -> markdown', (t) => {
  t.deepEqual(
    toMarkdown(
      {
        type: 'paragraph',
        children: [
          {type: 'text', value: 'a '},
          // @ts-expect-error: `children`, `name` missing.
          {type: 'textDirective'},
          {type: 'text', value: ' b.'}
        ]
      },
      {extensions: [directiveToMarkdown]}
    ),
    'a : b.\n',
    'should try to serialize a directive (text) w/o `name`'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'paragraph',
        children: [
          {type: 'text', value: 'a '},
          // @ts-expect-error: `children` missing.
          {type: 'textDirective', name: 'b'},
          {type: 'text', value: ' c.'}
        ]
      },
      {extensions: [directiveToMarkdown]}
    ),
    'a :b c.\n',
    'should serialize a directive (text) w/ `name`'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    'a :b[c] d.\n',
    'should serialize a directive (text) w/ `children`'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    'a :b[c\\[d\\]e] f.\n',
    'should escape brackets in a directive (text) label'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    'a :b[c\nd] e.\n',
    'should support EOLs in a directive (text) label'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'paragraph',
        children: [
          {type: 'text', value: 'a '},
          {
            type: 'textDirective',
            name: 'b',
            // @ts-expect-error: should contain only `string`s
            attributes: {c: 'd', e: 'f', g: '', h: null, i: undefined, j: 2},
            children: []
          },
          {type: 'text', value: ' k.'}
        ]
      },
      {extensions: [directiveToMarkdown]}
    ),
    'a :b{c="d" e="f" g j="2"} k.\n',
    'should serialize a directive (text) w/ `attributes`'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    'a :b{#d .a.b.c key="value"} k.\n',
    'should serialize a directive (text) w/ `id`, `class` attributes'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    'a :b{x="y&#x22;\'\r\nz"} k.\n',
    'should encode the quote in an attribute value (text)'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    'a :b{x="y&#x22;\'\r\nz"} k.\n',
    'should encode the quote in an attribute value (text)'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    'a :b{id="c#d"} e.\n',
    'should not use the `id` shortcut if impossible characters exist'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    'a :b{class="c.d e<f"} g.\n',
    'should not use the `class` shortcut if impossible characters exist'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    'a :b{.e.hij class="c.d f<g"} k.\n',
    'should not use the `class` shortcut if impossible characters exist (but should use it for classes that don’t)'
  )

  t.deepEqual(
    // @ts-expect-error: `children`, `name` missing.
    toMarkdown({type: 'leafDirective'}, {extensions: [directiveToMarkdown]}),
    '::\n',
    'should try to serialize a directive (leaf) w/o `name`'
  )

  t.deepEqual(
    toMarkdown(
      // @ts-expect-error: `children` missing.
      {type: 'leafDirective', name: 'a'},
      {extensions: [directiveToMarkdown]}
    ),
    '::a\n',
    'should serialize a directive (leaf) w/ `name`'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'leafDirective',
        name: 'a',
        children: [{type: 'text', value: 'b'}]
      },
      {extensions: [directiveToMarkdown]}
    ),
    '::a[b]\n',
    'should serialize a directive (leaf) w/ `children`'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'leafDirective',
        name: 'a',
        children: [{type: 'text', value: 'b'}]
      },
      {extensions: [directiveToMarkdown]}
    ),
    '::a[b]\n',
    'should serialize a directive (leaf) w/ `children`'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'leafDirective',
        name: 'a',
        children: [{type: 'text', value: 'b\nc'}]
      },
      {extensions: [directiveToMarkdown]}
    ),
    '::a[b&#xA;c]\n',
    'should serialize a directive (leaf) w/ EOLs in `children`'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'leafDirective',
        name: 'a',
        attributes: {id: 'b', class: 'c d', key: 'e\nf'},
        children: []
      },
      {extensions: [directiveToMarkdown]}
    ),
    '::a{#b .c.d key="e&#xA;f"}\n',
    'should serialize a directive (leaf) w/ EOLs in `attributes`'
  )

  t.deepEqual(
    toMarkdown(
      // @ts-expect-error: `children`, `name` missing.
      {type: 'containerDirective'},
      {extensions: [directiveToMarkdown]}
    ),
    ':::\n:::\n',
    'should try to serialize a directive (container) w/o `name`'
  )

  t.deepEqual(
    toMarkdown(
      // @ts-expect-error: `children` missing.
      {type: 'containerDirective', name: 'a'},
      {extensions: [directiveToMarkdown]}
    ),
    ':::a\n:::\n',
    'should serialize a directive (container) w/ `name`'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'containerDirective',
        name: 'a',
        children: [{type: 'paragraph', children: [{type: 'text', value: 'b'}]}]
      },
      {extensions: [directiveToMarkdown]}
    ),
    ':::a\nb\n:::\n',
    'should serialize a directive (container) w/ `children`'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'containerDirective',
        name: 'a',
        children: [
          {type: 'heading', depth: 1, children: [{type: 'text', value: 'b'}]}
        ]
      },
      {extensions: [directiveToMarkdown]}
    ),
    ':::a\n# b\n:::\n',
    'should serialize a directive (container) w/ `children` (heading)'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'containerDirective',
        name: 'a',
        children: [
          {type: 'paragraph', children: [{type: 'text', value: 'b\nc'}]}
        ]
      },
      {extensions: [directiveToMarkdown]}
    ),
    ':::a\nb\nc\n:::\n',
    'should serialize a directive (container) w/ EOLs in `children`'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'containerDirective',
        name: 'a',
        attributes: {id: 'b', class: 'c d', key: 'e\nf'},
        children: []
      },
      {extensions: [directiveToMarkdown]}
    ),
    ':::a{#b .c.d key="e&#xA;f"}\n:::\n',
    'should serialize a directive (container) w/ EOLs in `attributes`'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    ':::a[b]\n:::\n',
    'should serialize the first paragraph w/ `data.directiveLabel` as a label in a directive (container)'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    '::::a\n:::b\nc\n:::\n::::\n',
    'should serialize the outer containers w/ more colons than inner containers'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    '::::a\n:::b\nc\n:::\n\n:::d\ne\n:::\n::::\n',
    'should serialize w/ `3 + nesting`, not the total count (1)'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    ':::::a\n::::b\n:::c\nd\n:::\n::::\n:::::\n',
    'should serialize w/ `3 + nesting`, not the total count (2)'
  )

  t.deepEqual(
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
      {extensions: [directiveToMarkdown]}
    ),
    '::::a\n> :::b\n> c\n> :::\n::::\n',
    'should serialize w/ `3 + nesting`, not the total count (3)'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'paragraph',
        children: [{type: 'text', value: 'a:b'}]
      },
      {extensions: [directiveToMarkdown]}
    ),
    'a\\:b\n',
    'should escape a `:` in phrasing when followed by an alpha'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'paragraph',
        children: [{type: 'text', value: 'a:9'}]
      },
      {extensions: [directiveToMarkdown]}
    ),
    'a:9\n',
    'should not escape a `:` in phrasing when followed by a non-alpha'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'paragraph',
        children: [{type: 'text', value: 'a::c'}]
      },
      {extensions: [directiveToMarkdown]}
    ),
    'a::c\n',
    'should not escape a `:` in phrasing when preceded by a colon'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'paragraph',
        children: [{type: 'text', value: ':\na'}]
      },
      {extensions: [directiveToMarkdown]}
    ),
    ':\na\n',
    'should not escape a `:` at a break'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'paragraph',
        children: [{type: 'text', value: ':a'}]
      },
      {extensions: [directiveToMarkdown]}
    ),
    '\\:a\n',
    'should not escape a `:` at a break when followed by an alpha'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'paragraph',
        children: [{type: 'text', value: '::\na'}]
      },
      {extensions: [directiveToMarkdown]}
    ),
    '\\::\na\n',
    'should escape a `:` at a break when followed by a colon'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'paragraph',
        children: [{type: 'text', value: ':::\na'}]
      },
      {extensions: [directiveToMarkdown]}
    ),
    '\\:::\na\n',
    'should escape a `:` at a break when followed by two colons'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'paragraph',
        children: [{type: 'text', value: ':::\na'}]
      },
      {extensions: [directiveToMarkdown]}
    ),
    '\\:::\na\n',
    'should escape a `:` at a break when followed by two colons'
  )

  t.deepEqual(
    toMarkdown(
      {
        type: 'paragraph',
        children: [
          {type: 'textDirective', name: 'red', children: []},
          {type: 'text', value: ':'}
        ]
      },
      {extensions: [directiveToMarkdown]}
    ),
    ':red:\n',
    'should escape a `:` after a text directive'
  )

  t.end()
})
