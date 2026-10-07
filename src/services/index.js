// Central service exports. All paths point to services that actually exist in this project.
export * from './productService';
export {
  createStoreService,
  getStoreDataService,
  followStoreService,
  unfollowStoreService,
  updateStoreService,
  deleteStoreService,
  openStoreChat,
  getStoreProducts,
  getStoreProductCount,
} from './storeService';
export {
  logoutService,
  getCurrentUserService,
  getSessionService,
  loginService,
  signupService,
  updateUserService,
  changePasswordService,
  resetPasswordService,
  verifyOTPService,
  checkEmailExistsService,
  getUserByEmailService,
  deleteAccountService,
} from './authService';
export {
  createUserProfile,
  getUserProfile,
  updateUserProfile,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationSettings,
  updateNotificationSettings,
  getUnreadNotificationCount,
  deleteNotification,
  deleteAllNotifications,
  subscribeToNotifications,
  deleteUserProfile,
} from './Userservice';
export {
  getOrCreateChat,
  sendMessage,
  getChatMessages,
  getUserChats,
  markMessageAsRead,
  markChatAsRead,
  deleteChat,
  findChatWithUser,
  getUnreadMessageCount,
  subscribeToChat,
  subscribeToUserChats,
} from './chatService';
export { ReviewService } from './reviewService';
export * from './mediaUploadService';
export * from './Realtimeservice';

export { getNotifications, markNotificationRead, markAllNotificationsRead, getReviewCoupon } from './notificationService';

export { getAboutStats } from './aboutService';
