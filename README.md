# POE2 Quick Launch for Kakao

![DOWNLOAD@SNAPSHOT](https://img.shields.io/github/downloads/NERDHEAD-lab/POE2-quick-launch-for-kakao/1.0.0-SNAPSHOT/poe2-quick-launch-for-kakao.zip?style=for-the-badge&color=success&label=DOWNLOAD@SNAPSHOT)

![Demo](docs/demo_preview.gif)

> **[Demo]**: 여기에 추가할 데모 이미지(gif)를 `docs/demo_preview.gif` 경로에 추가해주세요.

Kakao Games의 Path of Exile (1 & 2) 웹 실행을 간소화하고 자동화하는 크롬 확장 프로그램입니다.
번거로운 홈페이지 접속, 게임 시작 버튼 찾기, 모달 닫기 과정을 자동으로 처리하여 빠르게 게임에 진입할 수 있도록 돕습니다.

## 주요 기능

- **원클릭 게임 실행**: 확장 프로그램 팝업에서 바로 게임 실행 (POE 1, POE 2 지원)
- **자동 시작 처리**: `#autoStart` 기능을 통해 홈페이지 로딩 후 자동으로 "게임 시작" 버튼 클릭
- **스마트 탭 관리**: 게임 실행 후 자동으로 홈페이지 탭을 닫거나 정리 (설정 가능)
- **보안 센터 자동 패스**: "지정 PC 등록" 등 보안 확인 버튼 자동 감지 및 클릭
- **플러그인 제어**: 필요에 따라 플러그인 기능 일시 정지/재개

## 다운로드

> 🚧 **Chrome Web Store 출시 예정**
>
> 현재 마켓 심사 준비 중입니다. 개발용으로 직접 빌드하여 사용할 수 있습니다.

## 개발 및 설치 가이드

이 프로젝트는 Vite + React + TypeScript 기반의 크롬 확장 프로그램입니다.

### 요구 사항

- Node.js 22+
- npm

### 설치 및 로드 방법

1. **프로젝트 클론 및 의존성 설치**:
    ```bash
    git clone https://github.com/NERDHEAD-lab/POE2-quick-launch-for-kakao.git
    cd POE2-quick-launch-for-kakao
    npm install
    ```

2. **빌드**:
    ```bash
    npm run build
    # 또는 변경 사항 실시간 감지 (개발 모드)
    npm run dev
    ```
    위 명령어를 실행하면 `dist` 폴더에 확장 프로그램 파일이 생성됩니다.

3. **브라우저에 확장 프로그램 로드**:
    - **Chrome / Edge / Whale 등 크로미움 기반 브라우저**에서 주소창에 `chrome://extensions/` 입력
    - 우측 상단 **"개발자 모드"** 스위치 켜기
    - 좌측 상단 **"압축해제된 확장 프로그램을 로드합니다"** 클릭
    - 프로젝트 폴더 내의 `dist` 폴더 선택

## 기술 스택

- **Framework**: React, Vite
- **Language**: TypeScript
- **Style**: CSS (Vanilla)

## 라이선스

[MIT](LICENSE)
