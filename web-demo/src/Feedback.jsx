import { feedback } from "./feedback.config.js";

const questions = [
  ["이름", "닉네임도 괜찮아요"],
  ["전체 만족도", "1점 매우 불만족에서 5점 매우 만족"],
  ["이용 후기", "좋았던 점, 불편했던 점, 바라는 점"],
];

export default function Feedback() {
  return (
    <div className="stack">
      <section className="hero">
        <h1>앗차차 평가하기</h1>
        <p>사진 점검, 홈캠 화면, Android 앱을 써 보신 경험을 남겨 주세요. 남겨 주신 의견은 서비스 개선과 과제 평가에 사용됩니다.</p>
      </section>

      <section className="card">
        <h2>적어 주실 내용</h2>
        <ol className="fb-list">
          {questions.map(([title, hint]) => (
            <li key={title}><b>{title}</b><span>{hint}</span></li>
          ))}
        </ol>
        <p className="note">구글폼이 새 탭에서 열리며, 로그인 없이 1~2분이면 끝납니다.</p>
        <a className="btn fb-cta" href={feedback.formUrl} target="_blank" rel="noopener noreferrer">평가 남기기 (구글폼 열기)</a>
      </section>

      <section className="card">
        <h2>개인정보 수집·이용 안내</h2>
        <dl className="fb-notice">
          <dt>수집 목적</dt><dd>{feedback.notice.purpose}</dd>
          <dt>수집 항목</dt><dd>{feedback.notice.items}</dd>
          <dt>보관 기간</dt><dd>{feedback.notice.retention}</dd>
          <dt>처리 방식</dt><dd>구글폼에 제출되며 응답은 폼을 만든 사람의 구글 계정에 저장됩니다</dd>
        </dl>
        <p className="note">응답을 제출하면 위 내용에 동의한 것으로 봅니다. 동의하지 않으면 제출하지 마세요. 이름 대신 닉네임을 써도 됩니다.</p>
      </section>
    </div>
  );
}
