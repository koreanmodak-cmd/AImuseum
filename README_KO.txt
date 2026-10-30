FORM — Generative Art Studio / Museum
=====================================

이번 버전의 방향
----------------
- 외부 AI 모델, 무료 API 대기열, 유료 API를 전혀 사용하지 않습니다.
- 작품 생성은 art-engine.js의 절차적 알고리즘으로 브라우저 안에서 수행됩니다.
- 12개 스타일은 각각 다른 화면 구성 규칙을 사용합니다.
- 동일한 seed + style은 동일한 작품을 재현합니다.
- 음향은 Web Audio API로 브라우저에서 합성합니다. 외부 음원 파일이나 API는 없습니다.
- Firebase에는 작품 메타데이터만 저장하며 이미지 파일은 업로드하지 않습니다. 생성 엔진 버전도 함께 기록합니다.

파일 구성
---------
index.html       생성 스튜디오 UI
museum.html      공개 작품 아카이브 UI
art-engine.js    12종 조형 알고리즘 및 재현 가능한 시드 엔진
audio-engine.js  브라우저 기반 앰비언트 사운드 엔진
studio.js        스튜디오 동작, 내보내기, 공유, Firebase 게시
museum.js        아카이브, 페이지네이션, 큐레이션, 삭제
firestore.rules  Firestore 보안 규칙

설치
----
1. 위 파일을 같은 폴더에 둡니다.
2. index.html과 museum.html에서 FIREBASE_CONFIG가 본인의 Firebase 프로젝트 설정과 일치하는지 확인합니다.
3. Firebase Console > Authentication > Sign-in method에서 Anonymous 인증을 활성화합니다.
4. Firebase Console > Firestore Database > Rules로 이동합니다.
5. 제공한 firestore.rules 전체를 붙여넣고 Publish를 누릅니다.
6. 로컬 테스트는 Live Server 등 HTTP 서버로 실행하고, 공개 배포는 Firebase Hosting 또는 HTTPS 지원 정적 호스팅을 사용합니다.
   file:// 직접 열기보다 HTTP/HTTPS 실행을 권장합니다.

Firebase 보안 관련 중요 사항
---------------------------
사용자가 보내준 다음 규칙은 배포하면 안 됩니다.

  match /{document=**} {
    allow read, write: if true;
  }

이 규칙은 인증 여부와 관계없이 모든 방문자에게 Firestore 전체 문서의 읽기/쓰기 권한을 줍니다. 임의의 방문자가 작품을 수정하거나 삭제하고, 다른 컬렉션에도 데이터를 기록할 수 있습니다. 본 프로젝트에는 사용하지 마세요.

제공한 firestore.rules는 다음을 적용합니다.
- 공개 작품 읽기 허용
- 익명 인증을 마친 사용자만 새 작품 게시
- 게시할 때 ownerUid를 인증 UID로 고정
- 해당 UID 소유자만 작품 삭제
- 사용자 UID당 작품별 큐레이션 기록 1개만 생성
- 큐레이션 기록과 curateCount +1 업데이트가 하나의 Firestore transaction에서 함께 이뤄지는지 검사
- 그 외 컬렉션은 명시적으로 허용하지 않아 기본 거부
- 새 익명 계정을 반복 생성하는 행위까지 완벽하게 차단하지는 못합니다. 공개 서비스로 운영할 경우 Firebase App Check, 사용량 모니터링, abuse 대응을 추가로 검토하세요.

큐레이션 트랜잭션에서 getAfter()/existsAfter()를 사용하는 것은 Firestore 보안 규칙의 원자적 쓰기 검증 패턴입니다. Firebase 공식 문서:
https://firebase.google.com/docs/firestore/security/rules-conditions

기존 데이터 마이그레이션
-----------------------
- 기존 museum_arts 문서는 계속 공개 읽기가 가능합니다.
- 기존 문서에 ownerUid가 없으면 새 규칙 아래에서 소유자 삭제가 되지 않습니다. 이 문서는 Firebase Console에서 관리자가 정리하거나 별도 마이그레이션해야 합니다.
- 예전 버전이 저장한 password 필드는 새 버전에서 사용하지 않습니다. 기존 문서에 평문 비밀번호가 남아 있다면 Firestore Console에서 해당 필드를 제거하세요.
- 기존 비밀번호로 소유권을 확인하는 기능은 보안상 다시 도입하지 않았습니다.
- engineVersion은 생성 당시 엔진 버전을 기록하는 식별자입니다. 향후 알고리즘을 바꾸면서 예전 작품까지 픽셀 단위로 재현하려면 예전 엔진 코드를 별도로 보존하거나 생성 이미지를 보관해야 합니다.
- 작품 문서 삭제 시 Firestore 하위 curations 문서는 자동 삭제되지 않습니다. 작품량이 늘어난 뒤에는 Cloud Functions 등 신뢰할 수 있는 서버 환경의 정리 작업을 추가하는 편이 좋습니다. 클라이언트에서 보안 규칙을 완화해 일괄 삭제하도록 만들지 마세요.

Firestore 인덱스
----------------
최신순은 createdAt 내림차순으로 조회합니다.
인기순은 curateCount 내림차순 + createdAt 내림차순을 사용합니다. Firestore가 복합 색인 생성 링크를 표시하면 링크를 열어 해당 색인을 생성하세요.

동작 메모
--------
- 익명 계정은 비용 없이 사용할 수 있는 Firebase Authentication 방식이지만, 사용자가 브라우저 데이터를 지우거나 다른 기기를 사용하면 기존 UID를 잃어 작품 삭제 권한을 복구하지 못할 수 있습니다.
- Firebase 프로젝트의 사용량/요금제/할당량은 별도로 확인하세요. 이 코드는 외부 AI API를 호출하지 않습니다.
- 고해상도 저장은 3000 × 3000 px JPG를 브라우저에서 생성합니다. 기기 메모리가 부족하면 실패할 수 있으므로 다른 탭을 닫고 다시 시도하세요.
- 실제 인쇄 결과는 디스플레이, 색공간, 프린터, 용지에 따라 다릅니다.
- 알고리즘은 독창적인 추상 구성을 생성하도록 설계했지만, 미술계 거장의 평가나 인간 작가 수준의 미적 완성도를 보장할 수는 없습니다. 좋은 결과가 나오지 않으면 시드와 스타일을 바꾸어 탐색하세요.
- p5.js와 Firebase SDK는 CDN으로 로드하므로 페이지 실행 시 인터넷 연결이 필요합니다. 이미지 생성이나 오디오 합성은 API 호출 없이 브라우저에서 수행합니다.
