/**
 * @import {
 *   Directives,
 *   FromMarkdownOptions,
 *   LeafDirective,
 *   TextDirective,
 *   ToMarkdownOptions
 * } from 'mdast-util-directive'
 * @import {
 *   CompileContext,
 *   Extension as FromMarkdownExtension,
 *   Handle as FromMarkdownHandle,
 *   Token
 * } from 'mdast-util-from-markdown'
 * @import {
 *   ConstructName,
 *   Handle as ToMarkdownHandle,
 *   Options as ToMarkdownExtension,
 *   State
 * } from 'mdast-util-to-markdown'
 * @import {Nodes, Paragraph} from 'mdast'
 * @import {Point} from 'unist'
 */

import {ccount} from 'ccount'
import {ok as assert} from 'devlop'
import {
  asciiAlpha,
  unicodePunctuation,
  unicodeWhitespace
} from 'micromark-util-character'
import {parseEntities} from 'parse-entities'
import {stringifyEntitiesLight} from 'stringify-entities'

const own = {}.hasOwnProperty

/** @type {Readonly<FromMarkdownOptions>} */
const emptyFromMarkdownOptions = {}

/** @type {Readonly<ToMarkdownOptions>} */
const emptyOptions = {}

const shortcut = /^[^\t\n\r "#'.<=>`}]+$/
const unquoted = /^[^\t\n\r "'<=>`}]+$/

/**
 * Create an extension for `mdast-util-from-markdown` to enable directives in
 * markdown.
 *
 * @param {Readonly<FromMarkdownOptions> | null | undefined} [options]
 *   Configuration (optional).
 * @returns {FromMarkdownExtension}
 *   Extension for `mdast-util-from-markdown` to enable directives.
 */
export function directiveFromMarkdown(options) {
  const settings = options || emptyFromMarkdownOptions

  return {
    canContainEols: ['textDirective'],
    enter: {
      directiveContainer: enterContainer,
      directiveContainerAttributes: enterAttributes,
      directiveContainerLabel: enterContainerLabel,

      directiveLeaf: enterLeaf,
      directiveLeafAttributes: enterAttributes,

      directiveText: enterText,
      directiveTextAttributes: enterAttributes
    },
    exit: {
      directiveContainer: exit,
      directiveContainerAttributeClass: exitAttributeShortcut,
      directiveContainerAttributeClassValue: exitAttributeClassValue,
      directiveContainerAttributeId: exitAttributeShortcut,
      directiveContainerAttributeIdValue: exitAttributeIdValue,
      directiveContainerAttributeName: exitAttributeName,
      directiveContainerAttributeValue: exitAttributeValue,
      directiveContainerAttributeValueLiteral: exitAttributeValueLiteral,
      directiveContainerAttributes: exitAttributes,
      directiveContainerLabel: exitContainerLabel,
      directiveContainerName: exitName,
      directiveContainerSequence: exitSequence,

      directiveLeaf: exit,
      directiveLeafAttributeClass: exitAttributeShortcut,
      directiveLeafAttributeClassValue: exitAttributeClassValue,
      directiveLeafAttributeId: exitAttributeShortcut,
      directiveLeafAttributeIdValue: exitAttributeIdValue,
      directiveLeafAttributeName: exitAttributeName,
      directiveLeafAttributeValue: exitAttributeValue,
      directiveLeafAttributeValueLiteral: exitAttributeValueLiteral,
      directiveLeafAttributes: exitAttributes,
      directiveLeafLabel: exitLabel,
      directiveLeafName: exitName,
      directiveLeafSequence: exitSequence,

      directiveText: exit,
      directiveTextAttributeClass: exitAttributeShortcut,
      directiveTextAttributeClassValue: exitAttributeClassValue,
      directiveTextAttributeId: exitAttributeShortcut,
      directiveTextAttributeIdValue: exitAttributeIdValue,
      directiveTextAttributeName: exitAttributeName,
      directiveTextAttributeValue: exitAttributeValue,
      directiveTextAttributeValueLiteral: exitAttributeValueLiteral,
      directiveTextAttributes: exitAttributes,
      directiveTextLabel: exitLabel,
      directiveTextMarker: exitSequence,
      directiveTextName: exitName
    }
  }

  /**
   * Handle an end sequence.
   *
   * This starts the extra positional info if `verbose`.
   * Other handlers only add to it if it exists.
   *
   * @this {CompileContext}
   * @type {FromMarkdownHandle}
   */
  function exitSequence(token) {
    if (!settings.verbose) return

    const node = this.stack[this.stack.length - 1]
    assert(node, 'expected `node`')
    assert(
      node.type === 'containerDirective' ||
        node.type === 'leafDirective' ||
        node.type === 'textDirective'
    )
    const place = {start: point(token.start), end: point(token.end)}

    if (node.data && node.data.position) {
      assert(node.type === 'containerDirective')
      node.data.position.closing = place
    } else {
      node.data = {position: {opening: place}}
    }
  }
}

/**
 * Create an extension for `mdast-util-to-markdown` to enable directives in
 * markdown.
 *
 * @param {Readonly<ToMarkdownOptions> | null | undefined} [options]
 *   Configuration (optional).
 * @returns {ToMarkdownExtension}
 *   Extension for `mdast-util-to-markdown` to enable directives.
 */
export function directiveToMarkdown(options) {
  const settings = options || emptyOptions

  if (
    settings.quote !== '"' &&
    settings.quote !== "'" &&
    settings.quote !== null &&
    settings.quote !== undefined
  ) {
    throw new Error(
      'Invalid quote `' + settings.quote + '`, expected `\'` or `"`'
    )
  }

  handleDirective.peek = peekDirective

  return {
    handlers: {
      containerDirective: handleDirective,
      leafDirective: handleDirective,
      textDirective: handleDirective
    },
    unsafe: [
      {
        character: '\r',
        inConstruct: ['leafDirectiveLabel', 'containerDirectiveLabel']
      },
      {
        character: '\n',
        inConstruct: ['leafDirectiveLabel', 'containerDirectiveLabel']
      },
      {
        after: '[^\\s\\p{P}\\p{S}]',
        before: '[^:]',
        character: ':',
        inConstruct: ['phrasing'],
        unicode: true
      },
      {afterNode: 'textDirective', character: ':', inConstruct: ['phrasing']},
      {atBreak: true, before: ':+', character: ':'}
    ]
  }

  /**
   * Handle a directive node.
   *
   * @type {ToMarkdownHandle}
   * @param {Directives} node
   *   Directive node to handle.
   */
  function handleDirective(node, _, state, info) {
    const tracker = state.createTracker(info)
    const exit = state.enter(node.type)
    /** @type {string | undefined} */
    let content

    if (node.type === 'containerDirective') {
      const head = (node.children || [])[0]
      const children = inlineDirectiveLabel(head)
        ? node.children.slice(1)
        : node.children

      if (children && children.length > 0) {
        const current = tracker.current()
        content = state.containerFlow(
          {...node, children},
          {
            now: {line: current.now.line + 1, column: 1 + current.lineShift},
            lineShift: current.lineShift
          }
        )
      }
    }

    const sequence = fence(node, content ? longestColonLine(content) : 0)
    let value = tracker.move(sequence + (node.name || ''))
    const attributesValue = attributes(node, state)
    const after = info.after.charCodeAt(0)
    /** @type {LeafDirective | Paragraph | TextDirective | undefined} */
    let label

    if (node.type === 'containerDirective') {
      const head = (node.children || [])[0]
      label = inlineDirectiveLabel(head) ? head : undefined
    } else {
      label = node
    }

    if (label && label.children && label.children.length > 0) {
      const exit = state.enter('label')
      /** @type {ConstructName} */
      const labelType = `${node.type}Label`
      const subexit = state.enter(labelType)
      value += tracker.move('[')
      value += tracker.move(
        state.containerPhrasing(label, {
          ...tracker.current(),
          before: value,
          after: ']'
        })
      )
      value += tracker.move(']')
      subexit()
      exit()
    } else if (
      !attributesValue &&
      (after === 45 /* `-` */ ||
        after === 95 /* `_` */ ||
        !(unicodePunctuation(after) || unicodeWhitespace(after)))
    ) {
      value += tracker.move('[]')
    }

    value += tracker.move(
      attributesValue || (after === 123 /* `{` */ ? '{}' : '')
    )

    if (node.type === 'containerDirective') {
      if (content) {
        value += tracker.move('\n' + content)
      }

      value += tracker.move('\n' + sequence)
    }

    exit()
    return value
  }

  /**
   * Handle the attributes of a directive node and convert them to markdown.
   *
   * @param {Directives} node
   *   Directive node to handle.
   * @param {State} state
   *   Current state.
   * @returns {string}
   *   Serialized markdown.
   */
  function attributes(node, state) {
    const attributes = node.attributes || {}
    /** @type {Array<string>} */
    const values = []
    /** @type {string | undefined} */
    let classesFull
    /** @type {string | undefined} */
    let classes
    /** @type {string | undefined} */
    let id
    /** @type {string} */
    let key

    for (key in attributes) {
      if (
        own.call(attributes, key) &&
        attributes[key] !== undefined &&
        attributes[key] !== null
      ) {
        const value = encode(String(attributes[key]))

        // To do: next major:
        // Do not reorder `id` and `class` attributes when they do not turn into
        // shortcuts.
        // Additionally, join shortcuts: `#a .b.c d="e"` -> `#a.b.c d="e"`
        if (key === 'id') {
          id =
            settings.preferShortcut !== false && shortcut.test(value)
              ? '#' + value
              : quoted('id', value, node, state)
        } else if (key === 'class') {
          const list = value.split(/[\t\n\r ]+/)
          /** @type {Array<string>} */
          const classesFullList = []
          /** @type {Array<string>} */
          const classesList = []

          for (const item of list) {
            ;(settings.preferShortcut !== false && shortcut.test(item)
              ? classesList
              : classesFullList
            ).push(item)
          }

          classesFull =
            classesFullList.length > 0
              ? quoted('class', classesFullList.join(' '), node, state)
              : ''
          classes = classesList.length > 0 ? '.' + classesList.join('.') : ''
        } else {
          values.push(quoted(key, value, node, state))
        }
      }
    }

    if (classesFull) {
      values.unshift(classesFull)
    }

    if (classes) {
      values.unshift(classes)
    }

    if (id) {
      values.unshift(id)
    }

    return values.length > 0 ? '{' + values.join(' ') + '}' : ''
  }

  /**
   * Quote an attribute value if needed.
   *
   * @param {string} key
   *   Attribute name.
   * @param {string} value
   *   Attribute value (`&` already encoded).
   * @param {Directives} node
   *   Directive node.
   * @param {State} state
   *   Current state.
   * @returns {string}
   *   Quoted attribute value.
   */
  function quoted(key, value, node, state) {
    if (settings.collapseEmptyAttributes !== false && !value) return key

    if (settings.preferUnquoted && unquoted.test(value)) {
      return key + '=' + value
    }

    // If the alternative is less common than `quote`, switch.
    const preferred = settings.quote || state.options.quote || '"'
    const alternative = preferred === '"' ? "'" : '"'
    const appliedQuote =
      settings.quoteSmart &&
      ccount(value, preferred) > ccount(value, alternative)
        ? alternative
        : preferred
    const subset =
      node.type === 'textDirective'
        ? [appliedQuote]
        : [appliedQuote, '\n', '\r']

    return (
      key +
      '=' +
      appliedQuote +
      stringifyEntitiesLight(value, {subset}) +
      appliedQuote
    )
  }
}

/**
 * Handle the start of a container directive.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function enterContainer(token) {
  enter.call(this, 'containerDirective', token)
}

/**
 * Handle the start of a leaf directive.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function enterLeaf(token) {
  enter.call(this, 'leafDirective', token)
}

/**
 * Handle the start of a text directive.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function enterText(token) {
  enter.call(this, 'textDirective', token)
}

/**
 * Handle the start of a directive.
 *
 * @this {CompileContext}
 * @param {Directives['type']} type
 *   Kind.
 * @param {Token} token
 *   Token to handle.
 * @returns {undefined}
 *   Nothing.
 */
function enter(type, token) {
  this.enter({type, name: '', attributes: {}, children: []}, token)
}

/**
 * Handle the start of a directive node.
 *
 * @this {CompileContext}
 * @param {Token} token
 *   Token to handle.
 * @returns {undefined}
 *   Nothing.
 */
function exitName(token) {
  const node = this.stack[this.stack.length - 1]
  assert(node, 'expected `node`')
  assert(
    node.type === 'containerDirective' ||
      node.type === 'leafDirective' ||
      node.type === 'textDirective'
  )
  node.name = this.sliceSerialize(token)
  openingEnd(node, token)
}

/**
 * Handle the start of a container directive label.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function enterContainerLabel(token) {
  this.enter(
    {type: 'paragraph', data: {directiveLabel: true}, children: []},
    token
  )
}

/**
 * Handle the end of a container directive label.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function exitContainerLabel(token) {
  this.exit(token)
  const node = this.stack[this.stack.length - 1]
  assert(node, 'expected `node`')
  assert(node.type === 'containerDirective')
  openingEnd(node, token)
}

/**
 * Handle the end of a leaf or text directive label.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function exitLabel(token) {
  const node = this.stack[this.stack.length - 1]
  assert(node, 'expected `node`')
  assert(node.type === 'leafDirective' || node.type === 'textDirective')
  openingEnd(node, token)
}

/**
 * Handle the start of attributes.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function enterAttributes() {
  const node = this.stack[this.stack.length - 1]
  assert(node, 'expected `node`')
  assert(
    node.type === 'containerDirective' ||
      node.type === 'leafDirective' ||
      node.type === 'textDirective'
  )

  if (node.data && node.data.position) {
    this.data.directiveAttributePositions = {}
  }

  this.data.directiveAttributes = []
  this.buffer() // Capture EOLs
}

/**
 * Handle the end of a shortcut.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function exitAttributeShortcut(token) {
  const positions = this.data.directiveAttributePositions

  if (positions) {
    const list = this.data.directiveAttributes
    assert(list, 'expected `directiveAttributes`')
    const tail = list[list.length - 1]
    assert(tail, 'expected attribute')
    positions[tail[0]] = {start: point(token.start), end: point(token.end)}
  }
}

/**
 * Handle the end of a quoted attribute value.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function exitAttributeValueLiteral(token) {
  attributeEnd(this, token)
}

/**
 * Handle the end of an ID attribute value.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function exitAttributeIdValue(token) {
  const list = this.data.directiveAttributes
  assert(list, 'expected `directiveAttributes`')
  list.push([
    'id',
    parseEntities(this.sliceSerialize(token), {attribute: true})
  ])
}

/**
 * Handle the end of a class attribute value.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function exitAttributeClassValue(token) {
  const list = this.data.directiveAttributes
  assert(list, 'expected `directiveAttributes`')
  list.push([
    'class',
    parseEntities(this.sliceSerialize(token), {attribute: true})
  ])
}

/**
 * Handle the end of an attribute value.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function exitAttributeValue(token) {
  const list = this.data.directiveAttributes
  assert(list, 'expected `directiveAttributes`')
  const tail = list[list.length - 1]
  assert(tail, 'expected attribute')
  tail[1] = parseEntities(this.sliceSerialize(token), {attribute: true})
  attributeEnd(this, token)
}

/**
 * Handle the end of an attribute name.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function exitAttributeName(token) {
  const list = this.data.directiveAttributes
  assert(list, 'expected `directiveAttributes`')

  // Attribute names in CommonMark are significantly limited, so character
  // references can’t exist.
  const name = this.sliceSerialize(token)
  list.push([name, ''])

  const positions = this.data.directiveAttributePositions

  if (positions) {
    positions[name] = {start: point(token.start), end: point(token.end)}
  }
}

/**
 * Handle the end of the attributes.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function exitAttributes(token) {
  const list = this.data.directiveAttributes
  assert(list, 'expected `directiveAttributes`')
  /** @type {Record<string, string>} */
  const cleaned = {}
  for (const attribute of list) {
    if (attribute[0] === 'class' && cleaned.class) {
      cleaned.class += ' ' + attribute[1]
    } else {
      cleaned[attribute[0]] = attribute[1]
    }
  }

  const positions = this.data.directiveAttributePositions
  this.data.directiveAttributePositions = undefined
  this.data.directiveAttributes = undefined
  this.resume() // Drop EOLs
  const node = this.stack[this.stack.length - 1]
  assert(node, 'expected `node`')
  assert(
    node.type === 'containerDirective' ||
      node.type === 'leafDirective' ||
      node.type === 'textDirective'
  )
  node.attributes = cleaned

  if (positions) {
    assert(node.data && node.data.position, 'expected `position`')
    node.data.position.attributes = positions
  }

  openingEnd(node, token)
}

/**
 * Move the end of the opening of a directive, if tracked.
 *
 * @param {Directives} node
 *   Directive node.
 * @param {Token} token
 *   Token that ends the opening so far.
 * @returns {undefined}
 *   Nothing.
 */
function openingEnd(node, token) {
  if (node.data && node.data.position) {
    const {opening} = node.data.position
    assert(opening, 'expected `opening`')
    opening.end = point(token.end)
  }
}

/**
 * Move the end of the positional info of the current attribute, if tracked.
 *
 * @param {CompileContext} context
 *   Compile context.
 * @param {Token} token
 *   Token that ends the attribute so far.
 * @returns {undefined}
 *   Nothing.
 */
function attributeEnd(context, token) {
  const positions = context.data.directiveAttributePositions

  if (positions) {
    const list = context.data.directiveAttributes
    assert(list, 'expected `directiveAttributes`')
    const tail = list[list.length - 1]
    assert(tail, 'expected attribute')
    const position = positions[tail[0]]
    assert(position, 'expected position')
    position.end = point(token.end)
  }
}

/**
 * Copy a point.
 *
 * @param {Token['start']} d
 *   micromark point.
 * @returns {Point}
 *   unist point.
 */
function point(d) {
  return {line: d.line, column: d.column, offset: d.offset}
}

/**
 * Exit a directive node.
 *
 * @this {CompileContext}
 * @type {FromMarkdownHandle}
 */
function exit(token) {
  this.exit(token)
}

/**
 * Peek at a directive.
 *
 * @type {ToMarkdownHandle}
 */
function peekDirective() {
  return ':'
}

/**
 * Encode ampersands.
 *
 * @param {string} value
 *   Attribute value.
 * @returns {string}
 *   Encoded attribute value.
 */
function encode(value) {
  /** @type {Array<string>} */
  const result = []
  let start = 0
  let index = value.indexOf('&')

  while (index !== -1) {
    const code = value.charCodeAt(index + 1)

    if (code === 35 /* `#` */ || asciiAlpha(code)) {
      result.push(value.slice(start, index), '&#x26;')
      start = index + 1
    }

    index = value.indexOf('&', index + 1)
  }

  result.push(value.slice(start))
  return result.join('')
}

/**
 * Check if a node is an inline directive label.
 *
 * @param {Nodes | undefined} node
 *   Node to check.
 * @returns {node is Paragraph & {data: {directiveLabel: true}}}
 *   Whether the node is an inline directive label.
 */
function inlineDirectiveLabel(node) {
  return Boolean(
    node && node.type === 'paragraph' && node.data && node.data.directiveLabel
  )
}

/**
 * Determine the fence size for a directive node.
 *
 * @param {Directives} node
 *   Directive node.
 * @param {number} longest
 *   For containers, size of the longest line of colons.
 * @returns {string}
 *   Fence to use.
 */
function fence(node, longest) {
  let size = 0

  if (node.type === 'containerDirective') {
    size = Math.max(3, longest + 1)
  } else if (node.type === 'leafDirective') {
    size = 2
  } else {
    size = 1
  }

  return ':'.repeat(size)
}

/**
 * Get the size of the longest line of colons,
 * which can have spaces and tabs around it.
 *
 * @param {string} value
 *   Serialized markdown.
 * @returns {number}
 *   Size of the longest line of colons.
 */
function longestColonLine(value) {
  let longest = 0
  let index = 0

  while (index < value.length) {
    let size = 0
    let code = value.charCodeAt(index)

    while (code === 9 /* `\t` */ || code === 32 /* ` ` */) {
      code = value.charCodeAt(++index)
    }

    while (code === 58 /* `:` */) {
      size++
      code = value.charCodeAt(++index)
    }

    while (code === 9 /* `\t` */ || code === 32 /* ` ` */) {
      code = value.charCodeAt(++index)
    }

    // Something else on the line: not a line of colons.
    while (!(
      code === 10 /* `\n` */ ||
      code === 13 /* `\r` */ ||
      Number.isNaN(code)
    )) {
      size = 0
      code = value.charCodeAt(++index)
    }

    if (size > longest) longest = size
    index++
  }

  return longest
}
