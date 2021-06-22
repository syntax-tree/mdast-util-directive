/**
 * @typedef {import('mdast-util-from-markdown').Handle} FromMarkdownHandle
 * @typedef {import('mdast-util-from-markdown').Extension} FromMarkdownExtension
 * @typedef {import('mdast-util-to-markdown/lib/types.js').Node} Node
 * @typedef {import('mdast-util-to-markdown/lib/types.js').Parent} Parent
 * @typedef {import('mdast-util-to-markdown/lib/types.js').Handle} ToMarkdownHandle
 * @typedef {import('mdast-util-to-markdown/lib/types.js').Context} Context
 * @typedef {import('mdast-util-to-markdown/lib/types.js').Options} ToMarkdownExtension
 *
 * @typedef {Record<string, string>} Attributes
 * @typedef {{name: string, attributes?: Attributes}} Directive
 *
 * @typedef {Parent & Directive & {type: 'textDirective', children: Array.<import('mdast').PhrasingContent>}} TextDirective
 * @typedef {Parent & Directive & {type: 'leafDirective', children: Array.<import('mdast').PhrasingContent>}} LeafDirective
 * @typedef {Parent & Directive & {type: 'containerDirective', children: Array.<import('mdast').BlockContent>}} ContainerDirective
 */

import {decodeEntity} from 'parse-entities/decode-entity.js'
import {stringifyEntitiesLight} from 'stringify-entities'
import {visitParents} from 'unist-util-visit-parents'
import {containerFlow} from 'mdast-util-to-markdown/lib/util/container-flow.js'
import {containerPhrasing} from 'mdast-util-to-markdown/lib/util/container-phrasing.js'
import {checkQuote} from 'mdast-util-to-markdown/lib/util/check-quote.js'

const own = {}.hasOwnProperty

const shortcut = /^[^\t\n\r "#'.<=>`}]+$/

handleDirective.peek = peekDirective

/** @type {FromMarkdownExtension} */
export const directiveFromMarkdown = {
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
    directiveContainerAttributeClassValue: exitAttributeClassValue,
    directiveContainerAttributeIdValue: exitAttributeIdValue,
    directiveContainerAttributeName: exitAttributeName,
    directiveContainerAttributeValue: exitAttributeValue,
    directiveContainerAttributes: exitAttributes,
    directiveContainerLabel: exitContainerLabel,
    directiveContainerName: exitName,

    directiveLeaf: exit,
    directiveLeafAttributeClassValue: exitAttributeClassValue,
    directiveLeafAttributeIdValue: exitAttributeIdValue,
    directiveLeafAttributeName: exitAttributeName,
    directiveLeafAttributeValue: exitAttributeValue,
    directiveLeafAttributes: exitAttributes,
    directiveLeafName: exitName,

    directiveText: exit,
    directiveTextAttributeClassValue: exitAttributeClassValue,
    directiveTextAttributeIdValue: exitAttributeIdValue,
    directiveTextAttributeName: exitAttributeName,
    directiveTextAttributeValue: exitAttributeValue,
    directiveTextAttributes: exitAttributes,
    directiveTextName: exitName
  }
}

/** @type {ToMarkdownExtension} */
export const directiveToMarkdown = {
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
      before: '[^:]',
      character: ':',
      after: '[A-Za-z]',
      inConstruct: ['phrasing']
    },
    {atBreak: true, character: ':', after: ':'}
  ],
  handlers: {
    containerDirective: handleDirective,
    leafDirective: handleDirective,
    textDirective: handleDirective
  }
}

/** @type {FromMarkdownHandle} */
function enterContainer(token) {
  enter.call(this, 'containerDirective', token)
}

/** @type {FromMarkdownHandle} */
function enterLeaf(token) {
  enter.call(this, 'leafDirective', token)
}

/** @type {FromMarkdownHandle} */
function enterText(token) {
  enter.call(this, 'textDirective', token)
}

/**
 * @this {ThisParameterType<FromMarkdownHandle>}
 * @param {string} type
 * @param {Parameters<FromMarkdownHandle>[0]} token
 */
function enter(type, token) {
  // @ts-expect-error: custom node.
  this.enter({type, name: '', attributes: {}, children: []}, token)
}

/**
 * @this {ThisParameterType<FromMarkdownHandle>}
 * @param {Parameters<FromMarkdownHandle>[0]} token
 */
function exitName(token) {
  this.stack[this.stack.length - 1].name = this.sliceSerialize(token)
}

/** @type {FromMarkdownHandle} */
function enterContainerLabel(token) {
  this.enter(
    {type: 'paragraph', data: {directiveLabel: true}, children: []},
    token
  )
}

/** @type {FromMarkdownHandle} */
function exitContainerLabel(token) {
  this.exit(token)
}

/** @type {FromMarkdownHandle} */
function enterAttributes() {
  this.setData('directiveAttributes', [])
  this.buffer() // Capture EOLs
}

/** @type {FromMarkdownHandle} */
function exitAttributeIdValue(token) {
  /** @type {Array.<[string, string]>} */
  // @ts-expect-error: custom.
  const list = this.getData('directiveAttributes')
  list.push(['id', decodeLight(this.sliceSerialize(token))])
}

/** @type {FromMarkdownHandle} */
function exitAttributeClassValue(token) {
  /** @type {Array.<[string, string]>} */
  // @ts-expect-error: custom.
  const list = this.getData('directiveAttributes')
  list.push(['class', decodeLight(this.sliceSerialize(token))])
}

/** @type {FromMarkdownHandle} */
function exitAttributeValue(token) {
  /** @type {Array.<[string, string]>} */
  // @ts-expect-error: custom.
  const list = this.getData('directiveAttributes')
  list[list.length - 1][1] = decodeLight(this.sliceSerialize(token))
}

/** @type {FromMarkdownHandle} */
function exitAttributeName(token) {
  /** @type {Array.<[string, string]>} */
  // @ts-expect-error: custom.
  const list = this.getData('directiveAttributes')

  // Attribute names in CommonMark are significantly limited, so character
  // references can’t exist.
  list.push([this.sliceSerialize(token), ''])
}

/** @type {FromMarkdownHandle} */
function exitAttributes() {
  /** @type {Array.<[string, string]>} */
  // @ts-expect-error: custom.
  const list = this.getData('directiveAttributes')
  /** @type {Record.<string, string>} */
  const cleaned = {}
  let index = -1

  while (++index < list.length) {
    const attribute = list[index]

    if (attribute[0] === 'class' && cleaned.class) {
      cleaned.class += ' ' + attribute[1]
    } else {
      cleaned[attribute[0]] = attribute[1]
    }
  }

  this.setData('directiveAttributes')
  this.resume() // Drop EOLs
  this.stack[this.stack.length - 1].attributes = cleaned
}

/** @type {FromMarkdownHandle} */
function exit(token) {
  this.exit(token)
}

/**
 * @type {ToMarkdownHandle}
 * @param {TextDirective|LeafDirective|ContainerDirective} node
 */
function handleDirective(node, _, context) {
  const prefix = fence(node)
  const exit = context.enter(node.type)
  let value =
    prefix +
    (node.name || '') +
    label(node, context) +
    attributes(node, context)

  if (node.type === 'containerDirective') {
    const subvalue = content(node, context)
    if (subvalue) value += '\n' + subvalue
    value += '\n' + prefix
  }

  exit()
  return value
}

/** @type {ToMarkdownHandle} */
function peekDirective() {
  return ':'
}

/**
 * @param {TextDirective|LeafDirective|ContainerDirective} node
 * @param {Context} context
 * @returns {string}
 */
function label(node, context) {
  /** @type {Parent} */
  let label = node

  if (node.type === 'containerDirective') {
    if (!inlineDirectiveLabel(node)) return ''
    // @ts-expect-error: we just asserted it’s a parent.
    label = node.children[0]
  }

  const exit = context.enter('label')
  const subexit = context.enter(node.type + 'Label')
  const value = containerPhrasing(label, context, {before: '[', after: ']'})
  subexit()
  exit()
  return value ? '[' + value + ']' : ''
}

/**
 * @param {TextDirective|LeafDirective|ContainerDirective} node
 * @param {Context} context
 * @returns {string}
 */
function attributes(node, context) {
  const quote = checkQuote(context)
  const subset = node.type === 'textDirective' ? [quote] : [quote, '\n', '\r']
  const attrs = node.attributes || {}
  /** @type {Array.<string>} */
  const values = []
  /** @type {string|undefined} */
  let classesFull
  /** @type {string|undefined} */
  let classes
  /** @type {string|undefined} */
  let id
  /** @type {string} */
  let key

  for (key in attrs) {
    if (
      own.call(attrs, key) &&
      attrs[key] !== undefined &&
      attrs[key] !== null
    ) {
      const value = String(attrs[key])

      if (key === 'id') {
        id = shortcut.test(value) ? '#' + value : quoted('id', value)
      } else if (key === 'class') {
        const list = value.split(/[\t\n\r ]+/g)
        /** @type {Array.<string>} */
        const classesFullList = []
        /** @type {Array.<string>} */
        const classesList = []
        let index = -1

        while (++index < list.length) {
          ;(shortcut.test(list[index]) ? classesList : classesFullList).push(
            list[index]
          )
        }

        classesFull =
          classesFullList.length > 0
            ? quoted('class', classesFullList.join(' '))
            : ''
        classes = classesList.length > 0 ? '.' + classesList.join('.') : ''
      } else {
        values.push(quoted(key, value))
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

  /**
   * @param {string} key
   * @param {string} value
   * @returns {string}
   */
  function quoted(key, value) {
    return (
      key +
      (value
        ? '=' + quote + stringifyEntitiesLight(value, {subset}) + quote
        : '')
    )
  }
}

/**
 * @param {TextDirective|LeafDirective|ContainerDirective} node
 * @param {Context} context
 * @returns {string}
 */
function content(node, context) {
  return containerFlow(
    inlineDirectiveLabel(node)
      ? Object.assign({}, node, {children: node.children.slice(1)})
      : node,
    context
  )
}

/**
 * @param {TextDirective|LeafDirective|ContainerDirective} node
 * @returns {boolean}
 */
function inlineDirectiveLabel(node) {
  return Boolean(
    node.children &&
      node.children[0] &&
      node.children[0].data &&
      node.children[0].data.directiveLabel
  )
}

/**
 * @param {string} value
 * @returns {string}
 */
function decodeLight(value) {
  return value.replace(
    /&(#(\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi,
    decodeIfPossible
  )
}

/**
 * @param {string} $0
 * @param {string} $1
 * @returns {string}
 */
function decodeIfPossible($0, $1) {
  return decodeEntity($1) || $0
}

/**
 * @param {TextDirective|LeafDirective|ContainerDirective} node
 * @returns {string}
 */
function fence(node) {
  let size = 0

  if (node.type === 'containerDirective') {
    visitParents(node, 'containerDirective', onvisit)
    size += 3
  } else if (node.type === 'leafDirective') {
    size = 2
  } else {
    size = 1
  }

  return ':'.repeat(size)

  /** @type {import('unist-util-visit-parents').Visitor<TextDirective|LeafDirective|ContainerDirective>} */
  function onvisit(_, parents) {
    let index = parents.length
    let nesting = 0

    while (index--) {
      if (parents[index].type === 'containerDirective') {
        nesting++
      }
    }

    if (nesting > size) size = nesting
  }
}
