export interface QuestionSpeechCallbacks {
  onEnd: () => void
  onError: () => void
}

export interface QuestionSpeechPlayer {
  play(text: string, callbacks: QuestionSpeechCallbacks): void
  cancel(): void
}

export function createBrowserQuestionSpeechPlayer(): QuestionSpeechPlayer {
  return {
    play(text, callbacks) {
      if (
        typeof window === 'undefined' ||
        !('speechSynthesis' in window) ||
        typeof SpeechSynthesisUtterance === 'undefined'
      ) {
        callbacks.onError()
        return
      }

      try {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'zh-CN'
        utterance.voice =
          window.speechSynthesis
            .getVoices()
            .find((voice) => voice.lang.toLowerCase() === 'zh-cn') ?? null
        utterance.onend = callbacks.onEnd
        utterance.onerror = callbacks.onError
        window.speechSynthesis.speak(utterance)
      } catch {
        callbacks.onError()
      }
    },
    cancel() {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    },
  }
}
