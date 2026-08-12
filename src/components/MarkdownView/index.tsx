import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { ReactNode } from 'react'
import {
  parseMarkdown,
  type BlockNode,
  type InlineNode,
  type ListItem
} from '@/utils/markdown'
import { copyText } from '@/utils/clipboard'
import './index.css'

interface Props {
  source: string
  onToggleTask?: (lineIndex: number) => void
  className?: string
}

function openHref(href: string) {
  if (!/^https?:\/\//i.test(href)) return

  if (process.env.TARO_ENV === 'h5' && typeof window !== 'undefined') {
    window.open(href, '_blank', 'noopener,noreferrer')
    return
  }

  void copyText(href).then(() => {
    void Taro.showToast({ title: '链接已复制', icon: 'none', duration: 1500 })
  }).catch(() => {
    void Taro.showToast({ title: '链接已复制', icon: 'none', duration: 1500 })
  })
}

function renderInline(nodes: InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`
    switch (node.type) {
      case 'text':
        return (
          <Text key={key} className='md-text'>
            {node.text}
          </Text>
        )
      case 'strong':
        return (
          <Text key={key} className='md-strong'>
            {renderInline(node.children, key)}
          </Text>
        )
      case 'em':
        return (
          <Text key={key} className='md-em'>
            {renderInline(node.children, key)}
          </Text>
        )
      case 'code':
        return (
          <Text key={key} className='md-code'>
            {node.text}
          </Text>
        )
      case 'link':
        return (
          <Text
            key={key}
            className='md-link'
            onClick={(event) => {
              event.stopPropagation()
              openHref(node.href)
            }}
          >
            {renderInline(node.children, key)}
          </Text>
        )
      default:
        return null
    }
  })
}

function ListItemRow({
  item,
  ordered,
  index,
  onToggleTask
}: {
  item: ListItem
  ordered: boolean
  index: number
  onToggleTask?: (lineIndex: number) => void
}) {
  const isTask = !!item.task
  const checked = !!item.checked

  const canToggle = isTask && !!onToggleTask

  return (
    <View
      className={`md-li ${isTask ? 'md-task' : ''} ${isTask && checked ? 'md-task-done' : ''} ${canToggle ? 'md-task-interactive' : ''}`}
      ariaRole={canToggle ? 'button' : undefined}
      ariaLabel={canToggle ? (checked ? '取消完成' : '标记完成') : undefined}
      onClick={canToggle ? () => onToggleTask?.(item.lineIndex) : undefined}
    >
      {isTask ? (
        <View className={`md-checkbox ${checked ? 'checked' : ''} ${canToggle ? 'interactive' : ''}`}>
          {checked ? <Text className='md-checkbox-mark'>✓</Text> : null}
        </View>
      ) : ordered ? (
        <Text className='md-marker'>{index + 1}.</Text>
      ) : (
        <Text className='md-marker'>•</Text>
      )}
      <Text className={`md-li-body ${isTask && checked ? 'md-strike' : ''}`}>
        {renderInline(item.children, `li-${item.lineIndex}`)}
      </Text>
    </View>
  )
}

function renderBlock(block: BlockNode, index: number, onToggleTask?: (lineIndex: number) => void) {
  const key = `b-${index}`

  switch (block.type) {
    case 'heading':
      return (
        <View key={key} className={`md-h md-h${block.level}`}>
          <Text className={`md-h-text md-h${block.level}-text`}>
            {renderInline(block.children, key)}
          </Text>
        </View>
      )
    case 'paragraph':
      return (
        <View key={key} className='md-p'>
          <Text className='md-p-text'>{renderInline(block.children, key)}</Text>
        </View>
      )
    case 'blockquote':
      return (
        <View key={key} className='md-quote'>
          <Text className='md-quote-text'>{renderInline(block.children, key)}</Text>
        </View>
      )
    case 'list':
      return (
        <View key={key} className={`md-list ${block.ordered ? 'ordered' : 'unordered'}`}>
          {block.items.map((item, i) => (
            <ListItemRow
              key={`li-${item.lineIndex}-${i}`}
              item={item}
              ordered={block.ordered}
              index={i}
              onToggleTask={onToggleTask}
            />
          ))}
        </View>
      )
    default:
      return null
  }
}

export default function MarkdownView({ source, onToggleTask, className }: Props) {
  const blocks = parseMarkdown(source)
  if (blocks.length === 0) return null

  return (
    <View className={`md-view ${className || ''}`.trim()}>
      {blocks.map((block, index) => renderBlock(block, index, onToggleTask))}
    </View>
  )
}
