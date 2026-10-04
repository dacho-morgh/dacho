import React from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import { CopyButton } from './CopyButton'

export type CodeBlockProps = {
  code: string
  language?: string
  blockType: 'code'
}

type Props = CodeBlockProps & {
  className?: string
}

export const CodeBlock: React.FC<Props> = ({ className, code, language }) => {
  if (!code) return null

  return (
    <div className={[className, 'not-prose'].filter(Boolean).join(' ')}>
      <Highlight code={code} language={language || ''} theme={themes.vsDark}>
        {({ getLineProps, getTokenProps, tokens }) => (
          <pre className="overflow-x-auto rounded border border-border bg-black p-4 text-xs">
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ className: 'table-row', line })}>
                <span className="table-cell select-none text-right text-white/25">{i + 1}</span>
                <span className="table-cell pl-4">
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </span>
              </div>
            ))}
            <CopyButton code={code} />
          </pre>
        )}
      </Highlight>
    </div>
  )
}
