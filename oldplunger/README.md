![Herple...](/.assets/hurple.png)
<!-- Oldcord: bring back the past -->

# Oldplunger
WIP Discord mod, only usable on Oldcord. 

The AOT part of Oldplunger is still at `/www_assets/bootloader/patcher.js` which we intend to put in here, along with the shimming.

## Roadmap
- [ ] Patch webpack
- [ ] Plugin api
- [ ] AOT and shims (for Electron Compat and use Oldcord API/Gateway)

## How to make plugins

We intend to make our plugin system similar to how Vencord does (but not API compatible). If you want to, [check out this guide](https://gist.github.com/sunnniee/28bd595f8c07992f6d03289911289ba8), 
just replace Vencord things with Oldplunger things, for example, definedPlugin -> plain old export default. Shifting your mind from (current year) to 2015-2018 works too, aka don't blindly follow the guide.