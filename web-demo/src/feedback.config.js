// 평가 수집은 구글폼으로 연결한다. 응답은 폼 소유자의 구글 계정에 쌓이고, 새 응답이 오면 메일 알림이 간다.
// 폼 주소를 바꾸려면 아래 값을 수정하거나 빌드할 때 VITE_FEEDBACK_FORM_URL로 지정한다.
export const feedback = {
  formUrl: import.meta.env.VITE_FEEDBACK_FORM_URL
    || "https://docs.google.com/forms/d/e/1FAIpQLSehfoOsQDcQZe4CkNh7eRw2ihUVVVpesMras0sKqbiGC5Hkmg/viewform",
  // 폼 첫 화면의 개인정보 안내와 같은 내용이다. 폼 설명을 고치면 이 문구도 함께 고친다.
  notice: {
    purpose: "앗차차 앱 사용성 평가(과제)와 서비스 개선",
    items: "이름(닉네임 가능), 만족도, 이용 후기",
    retention: "과제 제출과 평가가 끝나면 삭제",
  },
};
