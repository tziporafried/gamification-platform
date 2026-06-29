import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, X, CheckCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { parseQrPayload } from '@/lib/qrPayload'

interface QrScanResult {
  participantCode?: string
  actionCode?: string
}

interface QrScannerProps {
  onScan: (data: QrScanResult) => void
}

export function QrScanner({ onScan }: QrScannerProps) {
  const [active, setActive] = useState(false)
  const [error, setError] = useState('')
  const [scannedParticipant, setScannedParticipant] = useState<string | null>(null)
  const [scannedAction, setScannedAction] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scannerIdRef = useRef<string>('')

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
  }, [])

  const handleClose = useCallback(() => {
    stopScanner()
    setActive(false)
    setScannedParticipant(null)
    setScannedAction(null)
    setError('')
  }, [stopScanner])

  const handleReset = useCallback(() => {
    setScannedParticipant(null)
    setScannedAction(null)
    setError('')
  }, [])

  const processQrPayload = useCallback((decodedText: string) => {
    setError('')

    const result = parseQrPayload(decodedText)
    if (!result.ok) {
      setError(result.error)
      return
    }

    const { participantCode, actionCode } = result.data

    if (participantCode && actionCode) {
      onScan({ participantCode, actionCode })
      stopScanner()
      setActive(false)
      setScannedParticipant(null)
      setScannedAction(null)
      return
    }

    if (participantCode) {
      setScannedParticipant(participantCode)
      onScan({ participantCode })
      if (scannedAction) {
        stopScanner()
        setActive(false)
        setScannedParticipant(null)
        setScannedAction(null)
      }
      return
    }

    if (actionCode) {
      setScannedAction(actionCode)
      onScan({ actionCode })
      if (scannedParticipant) {
        stopScanner()
        setActive(false)
        setScannedParticipant(null)
        setScannedAction(null)
      }
    }
  }, [onScan, scannedParticipant, scannedAction, stopScanner])

  useEffect(() => {
    if (!active) return

    const container = containerRef.current
    if (!container) return

    const scannerId = 'qr-reader-' + Date.now()
    scannerIdRef.current = scannerId

    const readerDiv = document.createElement('div')
    readerDiv.id = scannerId
    container.appendChild(readerDiv)

    const scanner = new Html5Qrcode(scannerId)
    scannerRef.current = scanner

    let lastScanned = ''
    let lastScanTime = 0

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        const now = Date.now()
        if (decodedText === lastScanned && now - lastScanTime < 2000) return
        lastScanned = decodedText
        lastScanTime = now
        processQrPayload(decodedText)
      },
      () => {}
    ).catch((err) => {
      setError(typeof err === 'string' ? err : 'לא ניתן לגשת למצלמה. ודאו שיש הרשאת גישה.')
    })

    return () => {
      scanner.stop().catch(() => {})
      if (container.contains(readerDiv)) {
        container.removeChild(readerDiv)
      }
    }
  }, [active, processQrPayload])

  const hasPartialScan = scannedParticipant || scannedAction

  if (!active) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => { setError(''); setActive(true) }}
      >
        <Camera size={16} className="ml-1.5" />
        סריקת QR
      </Button>
    )
  }

  return (
    <div className="rounded-xl border border-game-border bg-game-dark p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">סורק QR</span>
          {hasPartialScan && (
            <span className="text-[10px] text-gray-500">
              {scannedParticipant && !scannedAction && '— כעת סרקו משימה'}
              {!scannedParticipant && scannedAction && '— כעת סרקו משתתף'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasPartialScan && (
            <button
              onClick={handleReset}
              className="rounded-lg p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300"
              title="סריקה מחדש"
            >
              <RotateCcw size={14} />
            </button>
          )}
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-white/10 hover:text-gray-300"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {hasPartialScan && (
        <div className="mb-2 flex gap-2">
          <div className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium ${
            scannedParticipant ? 'bg-emerald-500/20 text-emerald-400' : 'bg-game-card text-gray-500'
          }`}>
            {scannedParticipant && <CheckCircle size={10} />}
            משתתף {scannedParticipant ? `(${scannedParticipant})` : ''}
          </div>
          <div className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium ${
            scannedAction ? 'bg-emerald-500/20 text-emerald-400' : 'bg-game-card text-gray-500'
          }`}>
            {scannedAction && <CheckCircle size={10} />}
            משימה {scannedAction ? `(${scannedAction})` : ''}
          </div>
        </div>
      )}

      <div ref={containerRef} className="overflow-hidden rounded-lg" style={{ minHeight: '250px' }} />
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}
