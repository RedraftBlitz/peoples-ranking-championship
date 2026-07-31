"use client";

import { useState } from "react";

export function SharedBoardActions({ boardName }: { boardName: string }) {
  const [message, setMessage] = useState("");

  async function shareBoard() {
    const url = window.location.href;
    const shareData = {
      title: `${boardName}'s 2026 PRC Board`,
      text: `See ${boardName}'s fantasy football Top 150.`,
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setMessage("Share menu opened");
        return;
      }
      await navigator.clipboard.writeText(url);
      setMessage("Board link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      window.prompt("Copy this Board link:", url);
      setMessage("Board link ready to copy");
    }
  }

  return (
    <div className="shared-board-actions">
      <button className="button gold" type="button" onClick={shareBoard}>
        Share This Board
      </button>
      <span aria-live="polite">{message}</span>
    </div>
  );
}
