# Workspace 사용성 설계 검토

검토일: 2026-10-08. 아래는 승인된 설계 기록이며 현재 공개 API와 검증 명령은 README.md에 있다.
구현 이름: `@devslab/workspace`. easy-tab은 이전 임시 후보였고 현재 패키지와 데모에서 제거했다.

## 제품 약속

메뉴와 화면 컴포넌트를 연결하면 열린 업무 탭, 단축키, 열린 화면 전환 모달을 제공한다.
처음 연 화면은 탭을 전환해도 유지하고 닫으면 해제한다. 앱 상태 관리, 서버 데이터 캐시,
브라우저 재시작 후 복원은 이 약속에 포함하지 않는다.
FM 소스는 읽기 참고만 했다. FM 브랜드, 업무 타입, 서버/API, 데이터는 가져오지 않는다.

## 검토한 선택지

1. Headless API만 제공: 자유롭지만 사용자가 탭과 모달을 모두 조립해야 한다.
2. 완성 컴포넌트만 제공: 설치는 쉽지만 기존 메뉴와 디자인 시스템을 붙이기 어렵다.
3. **권장: 공통 동작 + headless 파츠 + 기본 완성 컴포넌트.**
   처음에는 한 컴포넌트, 일부 변경은 슬롯, 전체 변경은 파츠 조합을 사용한다.

Headless는 필수다. CSS를 지우는 `unstyled`와 headless는 구분한다.
unstyled는 기본 DOM과 동작을 유지하며, headless는 마크업도 조립할 수 있어야 한다.
키보드/ARIA/포커스 동작은 파츠나 prop getter가 제공하고 사용자가 다시 구현하지 않는다.

## 기본 사용 경로

```tsx
import { Workspace } from '@devslab/workspace/solid';
import '@devslab/workspace/style.css';

const screens = [
  { id: 'orders', title: '주문', component: OrdersPage },
  { id: 'customers', title: '고객', component: CustomersPage },
];

<Workspace screens={screens} defaultScreen="orders" />;
```

필수 데이터는 화면 ID, 제목, 컴포넌트뿐이다. menus를 생략하면 위 목록에서 평면 메뉴를 만든다.
메뉴가 필요 없으면 `menu={false}`. 기본 UI는 소규모 예제를 위해 제공하며 앱 전체의 사이드바,
헤더, 권한 필터를 만들지 않는다. 첫 기본 화면과 모든 미방문 화면을 동시에 마운트하지 않는다.
페이지의 기존 props/context는 사용 앱의 어댑터 컴포넌트로 연결해 유지한다.
일반 페이지에 Workspace 전용 hook 사용을 강제하지 않는다.

기존 계층 메뉴는 선택 항목의 workspace 화면 ID만 연결한다. 메뉴의 URL/권한 모델을
라이브러리 모델로 전체 변환하도록 요구하지 않는다. 같은 메뉴로 열면 같은 탭을 선택한다.

## 기존 메뉴 연결

내부에서 연결할 때 `useWorkspace().open('orders')`를 사용한다.
외부에서 컨트롤러가 필요할 때만 `createWorkspace`를 만들고 `<Workspace controller={...}>`에 넘긴다.
컨트롤러 사용 시 화면 레지스트리와 maxTabs/가드를 두 군데서 설정하지 않는다.
컴포넌트 단독 설정과 컨트롤러 설정은 타입으로 상호 배타적으로 만든다.

공개 기본 명령은 open, select, close, showSwitcher, hideSwitcher, reset이다.
open은 등록된 화면을 열거나 선택한다. select는 이미 열린 탭만 선택한다.
비동기 가드는 성공 전에 탭을 추가하거나 기존 화면을 없애지 않는다.
빠른 연속 요청과 reset 이후 완료되는 오래된 요청은 커밋하지 않는다.
기본 명령의 예외/취소/탭 제한 결과는 UI 상태와 호출 결과 양쪽에서 전달한다.

## 디자인 변경 경로

1. 기본 스타일: 선택적으로 CSS를 import. CSS 변수로 색, 간격, 라운드와 크기를 조정한다.
2. `unstyled`: 기본 마크업의 data-part/data-state와 classNames로 스타일을 바꾼다.
   CSS가 없어도 비활성 화면 숨김, inert, 포커스 차단은 기능으로 보장한다.
3. 슬롯: 메뉴, 탭 라벨, 전환 항목, 빈 화면, 미리보기와 에러 표시를 교체한다.
4. headless 파츠: Provider, TabList, Tab, CloseButton, Panels, Switcher, SwitcherTrigger를
   기존 레이아웃과 디자인 시스템 버튼에 조립한다. 이름은 구현 때 확정한다.

슬롯에 클릭과 ARIA 책임을 떠넘기지 않는다. 기본 슬롯은 라벨/아이콘/내용을 교체한다.
전체 버튼을 교체하는 경로는 프레임워크별 composition 및 ref/event 병합을 지원한다.
Core import에는 Solid나 Kobalte가 없어야 한다. 각 UI 어댑터는 접근성 primitive를 재사용한다.
Core 자체만 사용하는 경우 DOM 접근성 구현이 필요하다는 점은 파츠 사용 경로와 구분한다.

전환 모달은 일반 항목 목록을 기본으로 한다. DOM 복제나 숨은 화면 재렌더로 미리보기를
자동 생성하지 않는다. 앱이 정적인 preview를 선택 제공하고 개인정보 노출 여부를 결정한다.
다른 디자인 시스템의 Dialog도 연결할 수 있도록 전환 상태/행동과 기본 Dialog를 분리한다.

## 기본 동작과 선택 설정

- 탭 상한 기본 9, 설정 가능. 넘으면 기존 작업을 자동 종료하지 않고 안내한다.
- 탭 슬롯 번호는 닫아도 재정렬하지 않는다. Alt+1–9와 Alt+Q를 기본으로 하되 변경/해제 가능.
- shortcuts를 사용하려고 별도 hotkey provider를 설치하도록 요구하지 않는다.
- 입력창, IME 조합 중, 반복 키, 앱 모달에서 workspace 단축키를 가로채지 않는다.
- 기본 탭 키보드 이동은 수동 활성화. 포커스 이동과 화면 선택을 구분한다.
- 화면 비활성은 hidden/inert이며 앱 모달 포털도 active에 따라 표시를 차단하도록 연결한다.
- desktop은 탭바와 모달, mobile은 가로 스크롤 탭바와 전환 sheet를 기본 제공한다.
  모바일에서 키보드 단축키 없이 모든 명령을 실행할 수 있어야 한다.
- 마지막 탭 닫기는 빈 화면. 고정 홈이나 닫기 금지는 선택 설정으로만 검토한다.
- beforeClose는 선택 연결. 기본은 바로 닫기. 변경 감지와 확인 문구/승인은 앱이 담당한다.

## 앱과의 경계

앱의 폼/검색/데이터 상태는 앱이 관리한다. 컴포넌트를 유지한다고 타이머, effect, 서버 요청을
자동 중단할 수는 없다. active accessor와 useActiveEffect 같은 선택 도구를 제공한다.
활성 effect의 cleanup은 비활성화/닫기 때 실행한다. Workspace가 자동 refetch하거나 invalidate하지 않는다.

라우터 연결은 선택 어댑터다. URL→화면의 초기 진입/뒤로가기와 화면→URL 전환을 함께 다루고
동기화 루프, 거절된 navigation, pending transition을 검증한다. 단순 onChange 예제만으로
양방향 라우팅을 해결했다고 주장하지 않는다. URL 검색 조건을 탭 ID와 임의로 합치지 않는다.

권한/회사 변경은 앱이 결정한다. reset은 명시적인 강제 폐기로 탭과 pending 작업을 지운다.
권한 검사는 서버/앱이 수행하며 beforeActivate는 그 결과를 연결하는 인터페이스일 뿐이다.
분석은 이벤트를 앱에 전달할 수 있지만 라이브러리가 이벤트를 외부 전송하지 않는다.
실시간 갱신도 앱이 활성 화면을 보고 판단한다.

## 네 프레임워크

공통 TypeScript 코어와 `./solid`, `./react`, `./vue`, `./svelte` 진입점을 제안한다.
기본 루트는 코어로 두어 소비자가 다른 프레임워크 런타임을 설치하지 않는다.
Solid 첫 구현을 진행하되 React/Vue/Svelte는 각각 native component/slot/ref/lifecycle 규칙을 따른다.
SvelteKit/Next/Nuxt 지원은 framework 지원만으로 주장하지 않고 SSR/hydration 증거로 구분한다.
코어만 공개되었다고 Vanilla 완성 UI를 제공한다고 표기하지 않는다.

## 현재 초기 구현과의 차이

설계 당시 프로토타입에는 프레임워크 독립 탭 상태, Solid UI, Kobalte 모달, 상태 유지, close guard,
IME 제외와 제한 검사가 있었다. 아래는 당시 보완 항목 기록이며 현재 구현·검증 상태는 README에 있다.

- 메뉴 숨김과 기존 메뉴 연결의 기본 API 정리.
- screens/controller 중복 등록 제거, 화면별 props 연결 예제.
- switcher 상태와 명령을 컨트롤러/headless API에 포함.
- open과 select의 의미 분리. 현재 select는 open과 같은 함수다.
- unstyled/classNames/data-part 및 접근성 파츠. 현재 슬롯 몇 개만 있으며 완전 headless가 아니다.
- 단축키 사용자 설정. 현재 Alt 조합 고정이다.
- 동적 화면 등록 정책과 레지스트리 변경/앱 identity 변경 처리.
- React/Vue/Svelte 어댑터, SSR/hydration, 라우터 어댑터는 아직 미구현.
- 브라우저 접근성 검증은 통과 근거가 확보되지 않았다. 상태 테스트 6개와 초기 빌드는 통과했지만
  이를 전체 라이브러리 완료로 취급하지 않는다.

## 사용성/검증 기준

첫 예제는 페이지 두 개 등록과 Workspace 한 개만으로 실행해야 한다.
기존 메뉴 예제는 기존 버튼에서 open 한 번만 연결하면 된다.
기본 디자인, unstyled, 기존 메뉴 연결, close 확인, 활성 구독을 데모별로 확인한다.
라벨 변경 때문에 keyboard/focus/ARIA 코드를 복제할 필요가 없어야 한다.

실제 브라우저에서 입력/스크롤/컴포넌트 인스턴스 유지, 닫은 뒤 정리, 가드 거절과 비동기 경쟁,
다중 Workspace 단축키 범위, 모달 포커스 복귀/탭 트랩, hidden 페이지 및 포털 접근성,
390px 화면과 desktop에서 axe 및 키보드 동작을 검증한다.
패키지 배포 산출물을 별도 소비 앱에 설치해 사용한다. 소스 직접 import 성공만으로 패키지
연결이 쉽다고 결론내리지 않는다. npm 공개와 외부 게시에는 별도 사용자 승인이 필요하다.

## 확인한 공개 자료

- Ark UI Tabs: https://ark-ui.com/docs/components/tabs
  Root Provider/controlled 사용, 조립 파츠, lazy mount와 unmount 정책의 참고.
- Kobalte Tabs: https://kobalte.dev/docs/core/components/tabs/
  Solid용 키보드/ARIA/포커스 primitive 참고.
- Dockview: https://dockview.dev/docs/overview/introduction/
  탭/도킹 레이아웃 범위와 비교. Workspace는 업무 화면 전환에 집중한다.
- DevsLab kokey/numkey 로컬 package.json: 코어와 프레임워크별 subpath export 관례.

MIT/Apache-2.0은 기존 DevsLab OSS에 모두 있다. DDS/site-kit는 source-available이며 일반 OSS
라이선스와 구분한다. 라이선스와 패키지 이름의 registry 사용 가능 여부는 공개 전 별도로 확정한다.
