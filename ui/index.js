import LoginPage from './LoginPage.js';
import ProfilePage from './ProfilePage.js';
import SettingsPage from './SettingsPage.js';
import AdminDashboard from './AdminDashboard.js';
import RoleManager from './RoleManager.js';
import UserManager from './UserManager.js';
import TeamManager from './TeamManager.js';

export default {
  views: {
    'login-page': LoginPage,
    'profile-page': ProfilePage,
    'settings-page': SettingsPage,
    'admin-dashboard': AdminDashboard,
    'role-manager': RoleManager,
    'user-manager': UserManager,
    'teams-page': TeamManager,
  },
};
