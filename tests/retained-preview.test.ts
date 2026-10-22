// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountRetainedPreview } from '../src/retained-preview'

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals() })
function setup(html: string) {
  const source = document.createElement('section'); source.innerHTML = html
  const host = document.createElement('div')
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({ width: 240, height: 150 } as DOMRect)
  document.body.append(source, host)
  return { source, host }
}
describe('retained screen previews', () => {
  it('copies live controls and scroll offsets without changing the source or copying its listeners', () => {
    const { source, host } = setup('<form action="/write"><label for="query">검색</label><input id="query" name="q" value="old"><input type="checkbox"><textarea>old</textarea><select multiple><option>One</option><option>Two</option></select><button>등록</button></form><div class="scroll">실제 배송 목록</div>')
    source.querySelector('input')!.value = '유지된 검색'
    source.querySelector<HTMLInputElement>('[type=checkbox]')!.checked = true
    source.querySelector('textarea')!.value = '작성 중 초안'
    source.querySelector('select')!.options[1]!.selected = true
    const scroller = source.querySelector<HTMLElement>('.scroll')!
    scroller.scrollTop = 75; scroller.scrollLeft = 20
    const callback = vi.fn(); source.querySelector('button')!.addEventListener('click', callback)
    const before = source.outerHTML
    const dispose = mountRetainedPreview(host, source)
    expect(host.textContent).toContain('실제 배송 목록')
    expect(host.querySelector('input')!.value).toBe('유지된 검색')
    expect(host.querySelector<HTMLInputElement>('[type=checkbox]')!.checked).toBe(true)
    expect(host.querySelector('textarea')!.value).toBe('작성 중 초안')
    expect(host.querySelector('select')!.options[1]!.selected).toBe(true)
    expect(host.querySelector<HTMLElement>('.scroll')!.scrollTop).toBe(75)
    expect(host.querySelector<HTMLElement>('.scroll')!.scrollLeft).toBe(20)
    host.querySelector('button')!.click(); expect(callback).not.toHaveBeenCalled()
    expect(host.querySelector('form')).toBeNull()
    expect(source.outerHTML).toBe(before)
    expect(source.querySelector('input')!.value).toBe('유지된 검색')
    dispose()
  })
  it('masks passwords, hidden inputs and explicitly private subtrees without retaining their attributes', () => {
    const { source, host } = setup('<input type="password" value="initial-password"><input type="hidden" value="csrf-secret"><div data-workspace-preview-private title="private-title"><span>private-patient</span></div><textarea data-private>private-memo</textarea><input autocomplete="one-time-code" value="123456">')
    source.querySelector('input')!.value = 'current-password'
    const dispose = mountRetainedPreview(host, source)
    for (const secret of ['initial-password', 'current-password', 'csrf-secret', 'private-title', 'private-patient', 'private-memo', '123456']) expect(host.innerHTML).not.toContain(secret)
    expect(host.querySelector('input')!.value).not.toBe('current-password')
    expect(host.querySelector('textarea')!.value).not.toBe('private-memo')
    expect(source.querySelector('input')!.value).toBe('current-password')
    dispose()
  })
  it('does not copy a selected file path or construct a retained custom element again', () => {
    const { source, host } = setup('<input type="file"><x-retained-preview-test>Current chart</x-retained-preview-test>')
    Object.defineProperty(source.querySelector('input')!, 'value', { value: 'C:\\fakepath\\private.pdf' })
    const created = vi.fn()
    if (!customElements.get('x-retained-preview-test')) customElements.define('x-retained-preview-test', class extends HTMLElement { constructor() { super(); created() } })
    const before = created.mock.calls.length
    const dispose = mountRetainedPreview(host, source)
    expect(created).toHaveBeenCalledTimes(before)
    expect(host.querySelector('input')!.value).toBe('')
    expect(host.innerHTML).not.toContain('private.pdf')
    expect(host.textContent).toContain('Current chart')
    dispose()
  })
  it('does not construct or connect customized built-ins while cloning a retained screen', () => {
    const constructed = vi.fn()
    const connected = vi.fn()
    customElements.define('retained-preview-button', class extends HTMLButtonElement {
      constructor() { super(); constructed() }
      connectedCallback() { connected() }
    }, { extends: 'button' })
    const source = document.createElement('section')
    const button = document.createElement('button', { is: 'retained-preview-button' })
    button.setAttribute('is', 'retained-preview-button')
    button.textContent = '실제 저장 버튼'
    const internalOnly = document.createElement('button', { is: 'retained-preview-button' })
    internalOnly.textContent = '속성 없는 기존 버튼'
    expect(internalOnly.hasAttribute('is')).toBe(false)
    source.append(button, internalOnly)
    const host = document.createElement('div')
    document.body.append(source, host)
    const originalConstructed = constructed.mock.calls.length
    const originalConnected = connected.mock.calls.length
    const dispose = mountRetainedPreview(host, source)
    expect(constructed).toHaveBeenCalledTimes(originalConstructed)
    expect(connected).toHaveBeenCalledTimes(originalConnected)
    expect(host.querySelector('[is]')).toBeNull()
    expect(host.textContent).toContain('실제 저장 버튼')
    expect(host.textContent).toContain('속성 없는 기존 버튼')
    expect(button.getAttribute('is')).toBe('retained-preview-button')
    dispose()
  })
  it('strips IDs, references, navigation, inline handlers, embedded documents and executable custom elements', () => {
    const { source, host } = setup('<a id="a" href="https://outside.example" aria-controls="popup" aria-labelledby="label" onclick="alert(1)">실제 거래처</a><iframe src="https://outside.example"></iframe><script>throw 1</script><input autofocus name="q" aria-describedby="help"><button formaction="/write">저장</button><x-test-widget>이미 보이는 내용</x-test-widget>')
    source.setAttribute('data-v-owned', '')
    const dispose = mountRetainedPreview(host, source)
    expect(host.querySelector('[id],[name],[for],[href],[onclick],[aria-controls],[aria-labelledby],[aria-describedby],[autofocus],[formaction],iframe,script,x-test-widget')).toBeNull()
    expect(host.textContent).toContain('이미 보이는 내용')
    expect(host.querySelector('[data-v-owned]')).not.toBeNull()
    expect(host.querySelector('[inert][aria-hidden="true"]')).not.toBeNull()
    expect(source.querySelector('iframe')).not.toBeNull()
    dispose()
  })
  it('fits hidden retained DOM with explicit fallback dimensions and disconnects its resize observer', () => {
    const { source, host } = setup('<h2>실제 수거 요청</h2>')
    source.hidden = true; source.style.display = 'none'
    const observers: Array<{ callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }> = []
    vi.stubGlobal('ResizeObserver', class {
      disconnect = vi.fn(); observe = vi.fn()
      constructor(callback: ResizeObserverCallback) { observers.push({ callback, disconnect: this.disconnect }) }
    })
    const dispose = mountRetainedPreview(host, source, { sourceWidth: 1200, sourceHeight: 750 })
    const canvas = host.querySelector<HTMLElement>('[data-workspace-preview-canvas]')!
    expect(canvas.style.transform).toContain('scale(0.2)')
    expect(canvas.style.width).toBe('1200px')
    expect(host.querySelector('section')!.hidden).toBe(false)
    vi.mocked(host.getBoundingClientRect).mockReturnValue({ width: 120, height: 150 } as DOMRect)
    observers[0]!.callback([], {} as ResizeObserver)
    expect(canvas.style.transform).toContain('scale(0.1)')
    dispose(); dispose()
    expect(observers[0]!.disconnect).toHaveBeenCalledOnce()
    expect(host.childNodes).toHaveLength(0)
    expect(source.hidden).toBe(true)
  })
  it('uses resize events without ResizeObserver and removes the listener on cleanup', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const { source, host } = setup('<p>실제 내역</p>')
    const remove = vi.spyOn(window, 'removeEventListener')
    const dispose = mountRetainedPreview(host, source)
    vi.mocked(host.getBoundingClientRect).mockReturnValue({ width: 120, height: 75 } as DOMRect)
    window.dispatchEvent(new Event('resize'))
    expect(host.querySelector<HTMLElement>('[data-workspace-preview-canvas]')!.style.transform).toContain('scale(0.1)')
    dispose()
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
  })
  it('is safe with absent SSR/missing retained roots and preserves host-owned content', () => {
    expect(() => mountRetainedPreview(null, null)()).not.toThrow()
    const { source, host } = setup('<p>실제 조회</p>')
    host.append('owned by adapter')
    const dispose = mountRetainedPreview(host, source)
    dispose()
    expect(host.textContent).toBe('owned by adapter')
    expect(() => mountRetainedPreview(host, null)()).not.toThrow()
  })
})
