import React from "react";
import { Link } from "react-router-dom";
import SidebarMenuList from './sidebarMenuList';
import SidebarMenuItem from './sidebarMenuItem';

import ic_servers from "../../assets/ic_servers.svg?react"
import ic_staff from "../../assets/ic_staff.svg?react"
import ic_users from "../../assets/ic_users.svg?react"
import ic_experiments from "../../assets/ic_experiments.svg?react"
import ic_applications from "../../assets/ic_applications.svg?react"
import ic_archived from "../../assets/ic_archived.svg?react"

import Oldboard from '../../assets/oldboard.png'

const Sidebar = ({ active }) => {
    return (
        <div className='mainPage-sidebar'>
            <div className='mainPage-sidebar-header'>
                <Link to='/'>
                    <img src={Oldboard} alt="Oldcboard logo"></img>
                </Link>
            </div>
            <div className='mainPage-sidebar-components'>
                <SidebarMenuList name="General">
                    <SidebarMenuItem path="/servers" name="Servers" Icon={ic_servers} active={active}></SidebarMenuItem>
                    <SidebarMenuItem path="/staff" name="Staff" Icon={ic_staff} active={active} disabled={true}></SidebarMenuItem>
                    <SidebarMenuItem path="/users" name="Users" Icon={ic_users} active={active} disabled={false}></SidebarMenuItem>
                    <SidebarMenuItem path="/experiments" name="Experiments" Icon={ic_experiments} active={active} disabled={true}></SidebarMenuItem>
                </SidebarMenuList>
                <SidebarMenuList name="Programs">
                    <SidebarMenuItem path="/applications" name="Applications" Icon={ic_applications} active={active} disabled={true}></SidebarMenuItem>
                    <SidebarMenuItem path="/archived" name="Archived" Icon={ic_archived} active={active} disabled={true}></SidebarMenuItem>
                </SidebarMenuList>
            </div>
        </div>
    )
};

export default Sidebar;