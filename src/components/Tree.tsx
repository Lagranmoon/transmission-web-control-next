// 树组件 — 复刻 EasyUI tree（展开折叠箭头、图标、选中高亮）
import type { ReactNode } from 'react'

export interface TreeNodeData {
  id: string
  text: ReactNode
  iconCls?: string
  children?: TreeNodeData[]
  state?: 'open' | 'closed'
  labelIndex?: number
  labelColor?: string
  path?: string
  downDir?: string
}

export function Tree({
  nodes,
  selectedId,
  onSelect,
  expanded,
  onToggle,
  indentSize = 16,
}: {
  nodes: TreeNodeData[]
  selectedId: string | null
  onSelect: (node: TreeNodeData) => void
  expanded: Set<string>
  onToggle?: (node: TreeNodeData, open: boolean) => void
  indentSize?: number
}) {
  return (
    <div className="eu-tree">
      {nodes.map((n) => (
        <TreeNode
          key={n.id}
          node={n}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={onToggle}
          indentSize={indentSize}
        />
      ))}
    </div>
  )
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  expanded,
  onToggle,
  indentSize,
}: {
  node: TreeNodeData
  depth: number
  selectedId: string | null
  onSelect: (node: TreeNodeData) => void
  expanded: Set<string>
  onToggle?: (node: TreeNodeData, open: boolean) => void
  indentSize: number
}) {
  const hasChildren = !!node.children?.length
  const isOpen = expanded.has(node.id)

  return (
    <>
      <div
        className={`eu-tree-node ${selectedId === node.id ? 'selected' : ''}`}
        onClick={() => onSelect(node)}
      >
        {/* 层级缩进：每个祖先层级一列（宽 indentSize），列内绘制连续竖参考线（A3 树线，样式见 app.css .eu-tree-indent.line） */}
        {Array.from({ length: depth }, (_, i) => (
          <span key={i} className="eu-tree-indent line" style={{ width: indentSize }} />
        ))}
        {hasChildren ? (
          <span
            className={`eu-tree-switch ${isOpen ? 'open' : 'closed'}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggle?.(node, !isOpen)
            }}
          />
        ) : (
          <span className="eu-tree-switch leaf" />
        )}
        {node.iconCls && <i className={`eu-tree-icon ${node.iconCls}`} />}
        <span className="eu-tree-title" style={node.labelColor ? { color: node.labelColor } : undefined}>
          {node.text}
        </span>
      </div>
      {hasChildren && isOpen && (
        <div>
          {node.children!.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              expanded={expanded}
              onToggle={onToggle}
              indentSize={indentSize}
            />
          ))}
        </div>
      )}
    </>
  )
}
