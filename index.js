import {decodeEntity} from 'parse-entities/decode-entity.js'
import repeatString from 'repeat-string'
import {stringifyEntitiesLight} from 'stringify-entities'
import {visitParents} from 'unist-util-visit-parents'
import containerFlow from 'mdast-util-to-markdown/lib/util/container-flow.js'
import containerPhrasing from 'mdast-util-to-markdown/lib/util/container-phrasing.js'
import checkQuote from 'mdast-util-to-markdown/lib/util/check-quote.js'

var own = {}.hasOwnProperty

var shortcut = /^[^\t\n\r "#'.<=>`}]+$/

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
  var attributes = this.getData('directiveAttributes')
  attributes[attributes.length - 1][1] = decodeLight(this.sliceSerialize(token))
}

function exitAttributeName(token) {
  // Attribute names in CommonMark are significantly limited, so character
  // references can’t exist.
  this.getData('directiveAttributes').push([this.sliceSerialize(token), ''])
}

function exitAttributes() {
  var attributes = this.getData('directiveAttributes')
  var cleaned = {}
  var index = -1
  var attribute

  while (++index < attributes.length) {
    attribute = attributes[index]

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
  var prefix = fence(node)
  var exit = context.enter(node.type)
  var value =
    prefix +
    (node.name || '') +
    label(node, context) +
    attributes(node, context)
  var subvalue

  if (node.type === 'containerDirective') {
    subvalue = content(node, context)
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
  var label = node
  var exit
  var subexit
  var value

  if (node.type === 'containerDirective') {
    if (!inlineDirectiveLabel(node)) return ''
    label = node.children[0]
  }

  exit = context.enter('label')
  subexit = context.enter(node.type + 'Label')
  value = containerPhrasing(label, context, {before: '[', after: ']'})
  subexit()
  exit()
  return value ? '[' + value + ']' : ''
}

function attributes(node, context) {
  var quote = checkQuote(context)
  var subset = node.type === 'textDirective' ? [quote] : [quote, '\n', '\r']
  var attrs = node.attributes || {}
  var values = []
  var id
  var classesFull
  var classes
  var value
  var key
  var index

  for (key in attrs) {
    if (own.call(attrs, key) && attrs[key] != null) {
      value = String(attrs[key])

      if (key === 'id') {
        id = shortcut.test(value) ? '#' + value : quoted('id', value)
      } else if (key === 'class') {
        value = value.split(/[\t\n\r ]+/g)
        classesFull = []
        classes = []
        index = -1

        while (++index < value.length) {
          ;(shortcut.test(value[index]) ? classes : classesFull).push(
            value[index]
          )
        }

        classesFull = classesFull.length
          ? quoted('class', classesFull.join(' '))
          : ''
        classes = classes.length ? '.' + classes.join('.') : ''
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

  return values.length ? '{' + values.join(' ') + '}' : ''

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
  var content = inlineDirectiveLabel(node)
    ? Object.assign({}, node, {children: node.children.slice(1)})
    : node

  return containerFlow(content, context)
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
  var size = 0

  if (node.type === 'containerDirective') {
    visitParents(node, 'containerDirective', onvisit)
    size += 3
  } else if (node.type === 'leafDirective') {
    size = 2
  } else {
    size = 1
  }

  return repeatString(':', size)

  function onvisit(node, parents) {
    var index = parents.length
    var nesting = 0

    while (index--) {
      if (parents[index].type === 'containerDirective') {
        nesting++
      }
    }

    if (nesting > size) size = nesting
  }
}
