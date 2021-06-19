import {decodeEntity} from 'parse-entities/decode-entity.js'
import {stringifyEntitiesLight} from 'stringify-entities'
import {visitParents} from 'unist-util-visit-parents'
import containerFlow from 'mdast-util-to-markdown/lib/util/container-flow.js'
import containerPhrasing from 'mdast-util-to-markdown/lib/util/container-phrasing.js'
import checkQuote from 'mdast-util-to-markdown/lib/util/check-quote.js'

const own = {}.hasOwnProperty

const shortcut = /^[^\t\n\r "#'.<=>`}]+$/

handleDirective.peek = peekDirective

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

function enterContainer(token) {
  enter.call(this, 'containerDirective', token)
}

function enterLeaf(token) {
  enter.call(this, 'leafDirective', token)
}

function enterText(token) {
  enter.call(this, 'textDirective', token)
}

function enter(type, token) {
  this.enter({type, name: '', attributes: {}, children: []}, token)
}

function exitName(token) {
  this.stack[this.stack.length - 1].name = this.sliceSerialize(token)
}

function enterContainerLabel(token) {
  this.enter(
    {type: 'paragraph', data: {directiveLabel: true}, children: []},
    token
  )
}

function exitContainerLabel(token) {
  this.exit(token)
}

function enterAttributes() {
  this.setData('directiveAttributes', [])
  this.buffer() // Capture EOLs
}

function exitAttributeIdValue(token) {
  this.getData('directiveAttributes').push([
    'id',
    decodeLight(this.sliceSerialize(token))
  ])
}

function exitAttributeClassValue(token) {
  this.getData('directiveAttributes').push([
    'class',
    decodeLight(this.sliceSerialize(token))
  ])
}

function exitAttributeValue(token) {
  const attributes = this.getData('directiveAttributes')
  attributes[attributes.length - 1][1] = decodeLight(this.sliceSerialize(token))
}

function exitAttributeName(token) {
  // Attribute names in CommonMark are significantly limited, so character
  // references can’t exist.
  this.getData('directiveAttributes').push([this.sliceSerialize(token), ''])
}

function exitAttributes() {
  const attributes = this.getData('directiveAttributes')
  const cleaned = {}
  let index = -1

  while (++index < attributes.length) {
    const attribute = attributes[index]

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

function exit(token) {
  this.exit(token)
}

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

function peekDirective() {
  return ':'
}

function label(node, context) {
  let label = node

  if (node.type === 'containerDirective') {
    if (!inlineDirectiveLabel(node)) return ''
    label = node.children[0]
  }

  const exit = context.enter('label')
  const subexit = context.enter(node.type + 'Label')
  const value = containerPhrasing(label, context, {before: '[', after: ']'})
  subexit()
  exit()
  return value ? '[' + value + ']' : ''
}

function attributes(node, context) {
  const quote = checkQuote(context)
  const subset = node.type === 'textDirective' ? [quote] : [quote, '\n', '\r']
  const attrs = node.attributes || {}
  const values = []
  let classesFull
  let classes
  let id
  let key

  for (key in attrs) {
    if (
      own.call(attrs, key) &&
      attrs[key] !== undefined &&
      attrs[key] !== null
    ) {
      let value = String(attrs[key])

      if (key === 'id') {
        id = shortcut.test(value) ? '#' + value : quoted('id', value)
      } else if (key === 'class') {
        value = value.split(/[\t\n\r ]+/g)
        classesFull = []
        classes = []
        let index = -1

        while (++index < value.length) {
          ;(shortcut.test(value[index]) ? classes : classesFull).push(
            value[index]
          )
        }

        classesFull =
          classesFull.length > 0 ? quoted('class', classesFull.join(' ')) : ''
        classes = classes.length > 0 ? '.' + classes.join('.') : ''
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

  function quoted(key, value) {
    return (
      key +
      (value
        ? '=' + quote + stringifyEntitiesLight(value, {subset}) + quote
        : '')
    )
  }
}

function content(node, context) {
  return containerFlow(
    inlineDirectiveLabel(node)
      ? Object.assign({}, node, {children: node.children.slice(1)})
      : node,
    context
  )
}

function inlineDirectiveLabel(node) {
  return (
    node.children &&
    node.children[0] &&
    node.children[0].data &&
    node.children[0].data.directiveLabel
  )
}

function decodeLight(value) {
  return value.replace(
    /&(#(\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi,
    decodeIfPossible
  )
}

function decodeIfPossible($0, $1) {
  return decodeEntity($1) || $0
}

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

  function onvisit(node, parents) {
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
