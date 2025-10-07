import React from 'react';
import { Link } from 'react-router-dom';

const SidebarMenuItem = ({ path, name, Icon, active }) => {
    return (
        <Link to={path}>
            <div className={active === name ? 'mainPage-sidebar-menuItem mainPage-sidebar-menuItem-active' : 'mainPage-sidebar-menuItem'}>
                <Icon style={{fill: "currentColor"}} />
                <div className='mainPage-sidebar-menuText'>{name}</div>
            </div>
        </Link>
    );
};

export default SidebarMenuItem;