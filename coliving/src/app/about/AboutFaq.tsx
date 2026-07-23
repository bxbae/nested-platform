"use client";

// 원본 HTML의 <script> 아코디언 로직(한 번에 하나만 열림)을 React 상태로 옮긴 것.
import { useState } from "react";
import styles from "./about.module.css";

const FAQS = [
  {
    q: "보증금은 정말 안전한가요?",
    a: "네. 보증금은 호스트 개인 계좌로 바로 전달되지 않고, 입주 확인이 완료될 때까지 플랫폼이 예치해요. 문제가 없을 때만 호스트에게 정산됩니다.",
  },
  {
    q: "계약 기간 중간에 나가고 싶으면 어떻게 하나요?",
    a: "최소 계약 기간(3개월) 이후에는 앱 내 예약 취소 절차를 통해 중도 해지할 수 있어요. 잔여 보증금은 정산 규정에 따라 환불돼요.",
  },
  {
    q: "룸메이트가 마음에 안 들면 매칭을 바꿀 수 있나요?",
    a: "입주 전이라면 다른 매물이나 매칭을 다시 탐색할 수 있어요. 입주 후 갈등이 있다면 운영팀에 신고해 중재를 요청할 수 있어요.",
  },
  {
    q: "호스트는 어떻게 매물을 등록하나요?",
    a: "사업자 정보와 소유·임대 권한 서류를 제출하면 운영팀이 심사해요. 승인 전까지는 검색 결과에 노출되지 않아요.",
  },
];

export default function AboutFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className={styles.faqList}>
      {FAQS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={item.q}
            className={`${styles.faqItem} ${isOpen ? styles.open : ""}`}
          >
            <button
              type="button"
              className={styles.faqQ}
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : i)}
            >
              {item.q}
              <span className={styles.plus}>+</span>
            </button>
            <div className={styles.faqA}>
              <div className={styles.faqAInner}>{item.a}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
