# DevsLab Workspace

[소스와 이슈](https://github.com/devslab-kr/workspace) · [공개 배포 절차](docs/releasing.md)

열린 업무 탭, 단축키, 화면 전환 모달을 제공한다. 공통 TypeScript 코어와 Solid·React·Vue·Svelte 어댑터를 구현했다. 앱의 폼·데이터·라우터·권한은 앱이 관리한다.

소스는 MIT 라이선스로 공개했다. `@devslab/workspace` 첫 npm 공개 배포를 준비 중이다. DDS는 별도의 source-available 디자인 시스템이다.

```tsx
import { Workspace } from '@devslab/workspace/solid';
import '@devslab/workspace/style.css';
<Workspace screens={[
  { id: 'orders', title: '주문', component: OrdersPage },
  { id: 'customers', title: '고객', component: CustomersPage },
]} defaultScreen="orders" />;
```

처음 연 화면만 마운트한다. 전환하면 hidden/inert로 유지하며 닫으면 해제한다. 다시 열면 새 인스턴스다. 기본 상한은 9개, 슬롯 번호는 재정렬하지 않는다. Alt+1–9로 선택하고 Alt+Q로 전환 모달을 연다. 방향키는 탭 포커스만 옮기고 Enter/Space가 선택하며 Delete가 닫는다. 모바일에서는 버튼으로 모든 명령을 실행한다.

기본 import와 `./core`는 프레임워크를 요구하지 않는다. 어댑터를 사용할 때만 해당 프레임워크와 Ark peer를 설치한다: Solid는 `solid-js`·`@ark-ui/solid`, React는 `react`·`react-dom`·`@ark-ui/react`, Vue는 `vue`·`@ark-ui/vue`, Svelte는 5.29 이상·`@ark-ui/svelte`. 공개 props와 콜백은 Workspace API이며 Ark details 객체를 전달하지 않는다.

기존 메뉴 안에서는 `useWorkspace().open(id)`만 연결한다. 바깥에서 접근해야 하면 `createWorkspace({screens,...})`로 컨트롤러를 만들고 `<Workspace controller={controller} screens={screens} menu={false}>`에 전달한다. 컨트롤러 사용 시 가드·상한·기본 화면을 컴포넌트에 중복 설정하지 않는다. 레지스트리는 생성 시 고정하며 앱 identity나 목록이 바뀌면 다시 마운트한다.

명령은 open/select/close/showSwitcher/hideSwitcher/reset이다. select는 열린 탭만 선택한다. 비동기 가드가 거절되거나 실패하면 현재 화면을 유지한다. 마지막 유효 요청만 반영한다. reset은 닫기 확인을 건너뛰고 전체 화면과 미완료 요청을 폐기하므로 로그아웃·회사 변경에 사용한다.

CSS는 선택이며 `--ws-*` 변수, classNames, 콘텐츠 슬롯, unstyled로 바꾼다. 전체 레이아웃은 WorkspaceProvider·WorkspaceTabList·WorkspaceTab·WorkspaceCloseButton·WorkspacePanels·WorkspaceSwitcher·WorkspaceSwitcherTrigger·WorkspaceStatus로 조립한다. 닫기 버튼은 role=tablist 바깥에 둔다. asChild는 기존 버튼의 이벤트와 ref를 연결하며 preventDefault가 동작을 취소한다. 비활성 화면 숨김과 포커스 차단은 CSS 없이도 유지된다.

DDS를 사용하면 라이선스가 적용된 DDS 토큰과 `@devslab/workspace/style.css` 다음에 `@devslab/workspace/dds.css`를 불러온다. 이 선택 파일은 DDS 변수만 참조하며 DDS 자산을 포함하지 않는다. 모달이 body에 포털로 렌더되므로 테마 변수는 `:root`에 설정하거나 워크스페이스와 모달 양쪽 클래스에 설정한다. 배경·글자·선·강조·포커스·오버레이·폰트·모달 반경/그림자를 변경할 수 있다.

페이지 전용 hook은 선택이다. useWorkspacePage/useActiveEffect로 활성 화면의 구독과 해제를 연결한다. 타이머·요청·캐시·앱 모달 포털은 앱이 관리한다. 라이브러리는 자동 조회, invalidate, DOM 미리보기 복제, 분석 전송을 하지 않는다. 입력창·IME·반복 키·모달에서는 단축키를 가로채지 않으며 shortcuts로 변경/해제할 수 있다.

기본 화면은 mount 후 열어 SSR은 빈 상태로 시작한다. 서버에서 현재 탭이 필요하면 요청별 컨트롤러를 먼저 열고 SSR에 전달한다. dir를 지정하면 서버에서도 올바른 RTL이 된다. Next/Nuxt/SvelteKit 통합은 검증했다고 주장하지 않는다.

선택 API `createHistoryWorkspace(options, browserHistory(window))`가 URL 진입·뒤로가기·앞으로가기를 연결한다. screenFromUrl/urlForScreen을 제공하고 controller/ready/dispose를 사용한다. 거절된 뒤로가기는 마지막 허용 URL로 replace하며 새 항목을 추가하지 않는다. 앱에서 화면을 고르면 변경된 URL만 push한다. dispose는 리스너와 화면을 정리한다. 동기 History 어댑터이며 TanStack 등의 비동기 loader·라우터 취소는 앱에서 연결한다.

검증 명령과 프레임워크별 사용법은 [영문 가이드](README.md), [React/Vue](docs/react-vue.md), [Svelte](src/svelte/README.md)에 있다. 공개·배포·임시 체크아웃 정리는 검증된 변경을 통합한 뒤 진행한다.
