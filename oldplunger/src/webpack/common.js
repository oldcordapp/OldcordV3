// Code taken from Cordwood

import { findByProps } from './search';

// React
export const React = findByProps('createElement');
export const ReactDOM = findByProps('render', 'findDOMNode');

// Flux
// TODO: Properly type Flux.Store to fix an inheritance error in SettingsView.
export const Flux = findByProps('Store', 'initialize');
export const FluxDispatcher = findByProps('_isDispatching', 'dispatch');

// react-router
export const Router = findByProps('transitionTo');
