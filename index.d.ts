import type {
  BlockContent,
  Data,
  DefinitionContent,
  Parent,
  PhrasingContent
} from 'mdast'
import type {Position} from 'unist'

export {directiveFromMarkdown, directiveToMarkdown} from './lib/index.js'

/**
 * Configuration.
 */
export interface FromMarkdownOptions {
  /**
   * Whether to add extra positional info about attributes to directives
   * (default: `false`).
   *
   * When `true`, directives with attributes get
   * `data.position.attributes`.
   */
  verbose?: boolean | null | undefined
}

/**
 * Positional info of an attribute of a directive.
 *
 * `start` and `end` span the whole attribute:
 * `#a`, `.a`, `a`, `a=b`, `a="b"`.
 */
export interface DirectiveAttributePosition extends Position {
  /**
   * Attribute name (`id` for `#a`, `class` for `.a`).
   */
  name: string

  /**
   * Positional info of the value, without quotes
   * (such as `b` in `a="b"`, or `a` in `#a`);
   * empty between the quotes for an empty quoted value (`a=""`);
   * not present when there is no value (`a`).
   *
   * Character references are not decoded:
   * this is the place of the raw value in the source.
   */
  value?: Position | undefined
}

/**
 * Extra positional info of a directive.
 */
export interface DirectiveDataPosition {
  /**
   * Positional info of every attribute, in source order.
   *
   * Duplicate attributes are all included.
   * For a given name, the last one is the one whose value is in
   * `attributes`,
   * except for `class`,
   * where the values of all of them are joined.
   *
   * Field added by `mdast-util-directive` when passing `verbose: true` to
   * `directiveFromMarkdown`.
   */
  attributes: Array<DirectiveAttributePosition>
}

/**
 * Configuration.
 */
export interface ToMarkdownOptions {
  /**
   * Collapse empty attributes: get `title` instead of `title=""`
   * (default: `true`).
   */
  collapseEmptyAttributes?: boolean | null | undefined
  /**
   * Prefer `#` and `.` shortcuts for `id` and `class`
   * (default: `true`).
   */
  preferShortcut?: boolean | null | undefined
  /**
   * Leave attributes unquoted if that results in less bytes
   * (default: `false`).
   */
  preferUnquoted?: boolean | null | undefined
  /**
   * Use the other quote if that results in less bytes
   * (default: `false`).
   */
  quoteSmart?: boolean | null | undefined
  /**
   * Preferred quote to use around attribute values
   * (default: the `quote` used by `mdast-util-to-markdown` for titles).
   */
  quote?: '"' | "'" | null | undefined
}

/**
 * Fields shared by directives.
 */
interface DirectiveFields {
  /**
   * Directive attributes.
   */
  attributes?: Record<string, string | null | undefined> | null | undefined

  /**
   * Directive name.
   */
  name: string
}

/**
 * Markdown directive (container form).
 */
export interface ContainerDirective extends DirectiveFields, Parent {
  /**
   * Node type of container directive.
   */
  type: 'containerDirective'

  /**
   * Children of container directive.
   */
  children: Array<BlockContent | DefinitionContent>

  /**
   * Data associated with the mdast container directive.
   */
  data?: ContainerDirectiveData | undefined
}

/**
 * Info associated with mdast container directive nodes by the ecosystem.
 */
export interface ContainerDirectiveData extends Data {
  /**
   * Extra positional info,
   * added when passing `verbose: true` to `directiveFromMarkdown`.
   */
  position?: DirectiveDataPosition | undefined
}

/**
 * Markdown directive (leaf form).
 */
export interface LeafDirective extends Parent, DirectiveFields {
  /**
   * Node type of leaf directive.
   */
  type: 'leafDirective'

  /**
   * Children of leaf directive.
   */
  children: Array<PhrasingContent>

  /**
   * Data associated with the mdast leaf directive.
   */
  data?: LeafDirectiveData | undefined
}

/**
 * Info associated with mdast leaf directive nodes by the ecosystem.
 */
export interface LeafDirectiveData extends Data {
  /**
   * Extra positional info,
   * added when passing `verbose: true` to `directiveFromMarkdown`.
   */
  position?: DirectiveDataPosition | undefined
}

/**
 * Markdown directive (text form).
 */
export interface TextDirective extends DirectiveFields, Parent {
  /**
   * Node type of text directive.
   */
  type: 'textDirective'

  /**
   * Children of text directive.
   */
  children: Array<PhrasingContent>

  /**
   * Data associated with the text leaf directive.
   */
  data?: TextDirectiveData | undefined
}

/**
 * Info associated with mdast text directive nodes by the ecosystem.
 */
export interface TextDirectiveData extends Data {
  /**
   * Extra positional info,
   * added when passing `verbose: true` to `directiveFromMarkdown`.
   */
  position?: DirectiveDataPosition | undefined
}

/**
 * Union of registered mdast directive nodes.
 *
 * It is not possible to register custom mdast directive node types.
 */
export type Directives = ContainerDirective | LeafDirective | TextDirective

// Add custom data tracked to turn markdown into a tree.
declare module 'mdast-util-from-markdown' {
  interface CompileData {
    /**
     * Attributes for current directive.
     */
    directiveAttributes?: Array<[string, string]> | undefined

    /**
     * Positional info of attributes for current directive,
     * when `verbose`.
     */
    directiveAttributePositions?: Array<DirectiveAttributePosition> | undefined
  }
}

// Add custom data tracked to turn a syntax tree into markdown.
declare module 'mdast-util-to-markdown' {
  interface ConstructNameMap {
    /**
     * Whole container directive.
     *
     * ```markdown
     * > | :::a
     *     ^^^^
     * > | :::
     *     ^^^
     * ```
     */
    containerDirective: 'containerDirective'

    /**
     * Label of a container directive.
     *
     * ```markdown
     * > | :::a[b]
     *         ^^^
     *   | :::
     * ```
     */
    containerDirectiveLabel: 'containerDirectiveLabel'

    /**
     * Whole leaf directive.
     *
     * ```markdown
     * > | ::a
     *     ^^^
     * ```
     */
    leafDirective: 'leafDirective'

    /**
     * Label of a leaf directive.
     *
     * ```markdown
     * > | ::a[b]
     *        ^^^
     * ```
     */
    leafDirectiveLabel: 'leafDirectiveLabel'

    /**
     * Whole text directive.
     *
     * ```markdown
     * > | :a
     *     ^^
     * ```
     */
    textDirective: 'textDirective'

    /**
     * Label of a text directive.
     *
     * ```markdown
     * > | :a[b]
     *       ^^^
     * ```
     */
    textDirectiveLabel: 'textDirectiveLabel'
  }
}

// Add nodes to content, register `data` on paragraph.
declare module 'mdast' {
  interface BlockContentMap {
    /**
     * Directive in flow content (such as in the root document, or block
     * quotes), which contains further flow content.
     */
    containerDirective: ContainerDirective

    /**
     * Directive in flow content (such as in the root document, or block
     * quotes), which contains nothing.
     */
    leafDirective: LeafDirective
  }

  interface ParagraphData {
    /**
     * Field set on the first paragraph which is a child of a container
     * directive.
     * When this is `true`, that means the paragraph represents the *label*:
     *
     * ```markdown
     * :::a[This is the label]
     * This is further things.
     * :::
     * ```
     */
    directiveLabel?: boolean | null | undefined
  }

  interface PhrasingContentMap {
    /**
     * Directive in phrasing content (such as in paragraphs, headings).
     */
    textDirective: TextDirective
  }

  interface RootContentMap {
    /**
     * Directive in flow content (such as in the root document, or block
     * quotes), which contains further flow content.
     */
    containerDirective: ContainerDirective

    /**
     * Directive in flow content (such as in the root document, or block
     * quotes), which contains nothing.
     */
    leafDirective: LeafDirective

    /**
     * Directive in phrasing content (such as in paragraphs, headings).
     */
    textDirective: TextDirective
  }
}
