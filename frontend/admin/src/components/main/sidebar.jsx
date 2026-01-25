import { Link } from 'react-router-dom';

import ic_applications from '../../assets/ic_applications.svg?react';
import ic_archived from '../../assets/ic_archived.svg?react';
import ic_bots from '../../assets/ic_bots.svg?react';
import ic_experiments from '../../assets/ic_experiments.svg?react';
import ic_messages from '../../assets/ic_messages.svg?react';
import ic_reports from '../../assets/ic_reports.svg?react';
import ic_servers from '../../assets/ic_servers.svg?react';
import ic_settings from '../../assets/ic_settings.svg?react';
import ic_staff from '../../assets/ic_staff.svg?react';
import ic_updates from '../../assets/ic_updates.svg?react';
import ic_users from '../../assets/ic_users.svg?react';
import OldcordAdmin from '../../assets/oldcordAdmin.svg';
import PRIVILEGE from './privilege';
import SidebarMenuItem from './sidebarMenuItem';
import SidebarMenuList from './sidebarMenuList';

const Sidebar = ({ active }) => {
  const user_data = JSON.parse(localStorage.getItem('user_data'));
  const privilege = user_data?.staff_details?.privilege ?? 0;

  return (
    <div className="mainPage-sidebar">
      <div className="mainPage-sidebar-header">
        <Link to="/">
          <img src={OldcordAdmin} alt="Oldcord Admin logo"></img>
        </Link>
      </div>
      <div className="mainPage-sidebar-components">
        <SidebarMenuList name="General">
          <SidebarMenuItem
            path="/users"
            name="Users"
            Icon={ic_users}
            active={active}
            disabled={privilege < PRIVILEGE.ADMIN}
          ></SidebarMenuItem>
          <SidebarMenuItem
            path="/bots"
            name="Bots"
            Icon={ic_bots}
            active={active}
            disabled={privilege < PRIVILEGE.ADMIN}
          ></SidebarMenuItem>
          <SidebarMenuItem
            path="/servers"
            name="Servers"
            Icon={ic_servers}
            active={active}
            disabled={privilege < PRIVILEGE.ADMIN}
          ></SidebarMenuItem>
          <SidebarMenuItem
            path="/messages"
            name="Messages"
            Icon={ic_messages}
            active={active}
            disabled={privilege < PRIVILEGE.MODERATOR}
          ></SidebarMenuItem>
          <SidebarMenuItem
            path="/reports"
            name="Reports"
            Icon={ic_reports}
            active={active}
            disabled={privilege < PRIVILEGE.JANITOR}
          ></SidebarMenuItem>
        </SidebarMenuList>
        <SidebarMenuList name="Internal">
          <SidebarMenuItem
            path="/staff"
            name="Staff"
            Icon={ic_staff}
            active={active}
            disabled={privilege < PRIVILEGE.INSTANCE_OWNER}
          ></SidebarMenuItem>
          <SidebarMenuItem
            path="/audit-logs"
            name="Audit Logs"
            Icon={ic_archived}
            active={active}
            disabled={privilege < PRIVILEGE.INSTANCE_OWNER}
          ></SidebarMenuItem>
        </SidebarMenuList>
        <SidebarMenuList name="Instance">
          <SidebarMenuItem
            path="/updates"
            name="Updates"
            Icon={ic_updates}
            active={active}
          ></SidebarMenuItem>
          <SidebarMenuItem
            path="/settings"
            name="Settings"
            Icon={ic_settings}
            active={active}
            disabled={privilege < PRIVILEGE.INSTANCE_OWNER}
          ></SidebarMenuItem>
        </SidebarMenuList>
      </div>
    </div>
  );
};

export default Sidebar;
