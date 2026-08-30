export function markConversationReadInList(conversations, conversationId) {
  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? { ...conversation, unreadCount: 0 }
      : conversation
  );
}

export function moveConversationToTop(conversations, updatedConversation) {
  return [
    updatedConversation,
    ...conversations.filter(
      (conversation) => conversation.id !== updatedConversation.id
    )
  ];
}
