# DDS와 Ark UI 비교 및 전환 제안

2026-10-08. DDS/FM 코드를 읽고 Ark 공식 문서와 MCP 응답을 비교한 설계 검토다.
아래는 구현 전 설계 검토 기록이다. 이후 변경과 검증은 README 및 각 DDS/FM 이관 문서에 기록하며, 이 문서의 당시 상태를 현재 완료 상태로 취급하지 않는다.

## 결론

DDS 디자인 가이드, tokens, CSS, icons는 유지하고, 웹 상호작용 primitive를 Ark로 점진적으로
교체하는 방향을 권장한다. Ark는 외형 디자인 시스템의 대체제가 아니라 headless 동작 기반이다.
React/Solid/Vue/Svelte용 DDS 래퍼에 같은 규칙을 적용하기 쉬워지지만 각 어댑터 검증은 여전히 필요하다.
React Native는 Ark 웹 지원과 별개이며 DDS의 플랫폼 독립 tokens/규칙을 유지할 이유다.

## 비교 대상

- DDS docs/design-system.md: 시맨틱 토큰, 테마, typography/spacing/radius/motion,
  플랫폼 경계, 접근성 및 component API 규칙.
- DDS docs/components.md: 버튼/폼/Select/탭/Dialog 등의 외형과 UX 계약.
- DDS tokens 빌드: CSS, Tailwind, JS/TS, Ionic 출력. Ark가 이 제품 토큰 파이프라인을 대신하지 않는다.
- DDS dds-solid의 controls.tsx, dialog.tsx, tabs.tsx, tooltip.tsx, toast.tsx와 해당 테스트.
- Ark 공식 Tabs, Dialog, Tooltip, Toast, composition, styling 문서.
- @ark-ui/mcp 실제 stdio: Solid 목록, Tabs/Dialog props 조회 성공.

## 유지/교체 맵

| 영역 | 현재 DDS | Ark 활용 | 제안 |
| --- | --- | --- | --- |
| 브랜드/토큰/테마 | 제품/회사 브랜드와 시맨틱 토큰 | 시각 값/스타일은 소비자 제공 | 유지 |
| typography/spacing/touch/focus 규칙 | DDS 가이드가 정의 | 앱의 시각 검증은 별도 필요 | 유지 |
| CSS/아이콘/레이아웃 | 프레임워크 독립 클래스/자산 | data-part/state 또는 class 적용 | 유지하고 state selector 매핑 |
| Button/IconButton | native button, loading/disabled 정책 | 복잡한 primitive가 필수 아님 | 기존 얇은 래퍼 유지 |
| TextField/textarea | native input/label/help/error | Field를 선택 활용 가능 | 기존 API 유지, 필요할 때 통합 |
| 단순 Select | native select를 가이드가 명시 | Ark custom Select는 다른 동작 모델 | native Select 유지 |
| Checkbox/Radio/Switch | native input+controlled state | group/indeterminate 등을 공통 primitive로 처리 가능 | 후순위, 실제 요구가 있을 때 |
| Dialog | 직접 focus cycle/Escape/outside/return 처리 | focus trap, initial/final focus, scroll/layer/dismiss controls | 전환 우선 대상 |
| Tabs | 직접 등록/roving focus/자동 활성화 | controlled, manual, orientation, lazy mount | 전환 우선 대상 |
| Tooltip | 직접 focus/hover open-close | delay, positioning, dismissal 등 | 전환 우선 대상 |
| Toast | 직접 queue/timer/live region | toast machine/position/timer 정책 | 전환 후보, 기존 API 감싸기 |
| 메뉴/Combobox/Popover/날짜 | DDS 범위 밖 또는 제품이 개별 연결 | Ark primitive 제공 | 새 공통 컴포넌트는 Ark 우선 |
| 사업 화면/Workspace | 앱 또는 별도 OSS | 원시 부품만 제공 | 우리 조합 로직 유지 |
| SSR/RTL/키보드/시각 검증 | 기존 검사/스토리 있음 | 기반 기능 제공 | 기존 검사 유지하고 회귀 추가 |

## 소스에서 확인한 차이

Dialog는 document keydown listener로 Tab/Escape를 처리한다. 현재 컴포넌트 소스에는
portal, background inert 처리, scroll lock, nested layer coordination 구현이 없다.
단순 focus cycle/Escape/복귀 테스트는 있으므로 기존 코드가 무검증이라고 말할 수는 없다.
복잡한 중첩·포털 상황에 필요한 기반을 계속 직접 확장하는 대신 Ark에 맡길 가치가 크다.
Ark 기능이 있다는 것과 DDS 래퍼가 올바르게 연결되었다는 것은 다른 검증이다.

Tabs는 방향키 이동과 동시에 선택을 바꾸며, orientation/disabled 등록값은 초기 시점에 저장한다.
manual activation이나 lazyMount 옵션은 현재 공개 API에 없다. TabPanel은 hidden으로 숨기며
inert와 화면 활성 수명주기를 제공하지 않는다. Workspace의 guard/pending/동적 close 정책은
Ark Tabs의 controlled 선택에 연결하고 그 자체로 자동 해결된다고 간주하지 않는다.

Tooltip은 pointer/focus에서 즉시 열고 닫는다. Toast는 duration timer를 직접 관리하고
컴포넌트 소스에 hover/focus pause 처리가 없다. docs/components.md는 toast auto-dismiss의
pause를 소비자 JS 책임으로 설명한다. Ark를 사용하면 이런 동작을 공통화할 수 있다.

native Select는 DDS가 명시적으로 선택한 UX다. Ark Select로 바꾸면 OS 모바일 picker/DOM/form
계약과 외형이 달라진다. 단순 목록은 native Select로 남기고 검색이 필요할 때 Combobox를 제공한다.

## 외부 API

제품 사용자는 계속 DDS의 간단한 Button/Dialog/Tabs API를 사용한다. 래퍼 내부에서
Ark Root/Trigger/Content를 조립한다. Ark props를 모든 DDS props로 그대로 재노출하면
교체 가능성과 단순성이 줄어든다. 필요한 선택 설정만 DDS 계약으로 정의한다.

예: 기존 `(open: boolean) => void` 콜백은 Ark의 `details.open`으로 변환한다.
busy 중 닫기 제한, 안전한 최초 포커스, outside dismiss 정책은 DDS/제품이 결정하고
Ark에 옵션/이벤트로 전달한다. Ark 도입만으로 FM 특유의 정책이 자동 생기지는 않는다.

## 전환 순서

1. 별도 Workspace에서 Ark Tabs/Dialog를 적용해 동적 탭·화면 유지·close guard·모달을 검증한다.
2. DDS 외부 API와 CSS/토큰을 유지한 Dialog/Tabs/Tooltip 래퍼 전환을 별도 작업으로 수행한다.
3. 기존 primitive/SSR/hydration/a11y 검사와 실제 브라우저 중첩 모달/포커스/RTL/모바일 검사를 실행한다.
4. pack한 패키지를 별도 consumer에 설치해 시각 회귀, dependency/bundle 변화, server export를 확인한다.
5. 검증된 컴포넌트부터 소비 앱에 단계적으로 적용한다. FM 운영 검수 중인 작업트리에서 교체하지 않는다.

정량 비용 절감이나 번들 크기는 아직 측정되지 않았으므로 수치를 주장하지 않는다.
SDK 버전은 고정해 검증하며 문서/MCP 최신 응답과 설치된 버전의 타입을 함께 확인한다.
preview 표기 기능은 안정 API와 구분한다. Workspace 핵심 단축키를 Ark Hotkeys preview에
바로 종속시키지 말고 stable 여부/IME 동작을 별도 검토한다.

## Workspace OSS와 DDS 경계

Workspace는 DDS를 필수 의존성으로 요구하지 않는다. Ark 동작+독립 스타일/unstyled를 제공하고
DevsLab 내부 사용자는 DDS 토큰과 디자인을 연결한다. DDS는 DevsLab Source-Available License이며
MIT/Apache OSS와 다르므로 DDS 구현/자산을 Workspace OSS에 그대로 복사하지 않는다.

## MCP 등록 및 검증

`codex mcp add ark-ui -- npx.cmd -y @ark-ui/mcp`로 global 설정에 신규 등록했다.
`codex mcp get ark-ui`에서 enabled/stdio/명령을 확인했다. 설치 실행 패키지는 @ark-ui/mcp 1.3.0,
서버가 보고한 serverInfo.version은 1.0.0이었다.
stdio initialize→tools/list→list_components(solid)→get_component_props(solid,tabs/dialog) 성공.
실행 스크립트는 scripts/check-ark-mcp.mjs, 응답은 docs/ark-mcp-*.json이다.
현재 채팅 native 도구 목록에 Ark가 hot reload된 사실은 확인되지 않았다.
터미널에서 `npx -y @ark-ui/mcp`만 실행하면 서버는 정상적으로 stdio 요청을 기다린다.
UI를 열거나 CLI 대화 화면을 출력하는 프로그램은 아니다. 앱이 설정의 명령으로 서버를 실행한다.

## 공식 참고

- https://ark-ui.com/docs/guides/styling
- https://ark-ui.com/docs/guides/composition
- https://ark-ui.com/docs/components/dialog
- https://ark-ui.com/docs/components/tabs
- https://ark-ui.com/docs/components/tooltip
- https://ark-ui.com/docs/components/toast
- https://ark-ui.com/docs/ai/mcp-server
