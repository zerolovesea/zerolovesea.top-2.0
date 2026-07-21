---
title: "Essential developer skills: common Vim commands"
description: "Frequently used Vim commands."
pubDate: "2024-03-03 18:22:53"
---

Vim is a common editor on servers, so most developers eventually need to work with it. When I first encountered it, I was completely lost. Even after learning a few basics, many commands still felt unfamiliar. This post collects useful operations for future reference.

**Cursor movement**:

`h`: left  
`j`: down  
`k`: up  
`l`: right

> The commands below are especially useful and worth memorizing:

`w`: move to the start of the next word  
`b`: move to the start of the previous word  
`gg`: jump to the start of the file  
`G`: jump to the end of the file  
`0`: jump to the start of the line  
`$`: jump to the end of the line

Numbers can be combined with commands to move quickly to a specific position. For example:

`50G`: jump to line 50  
`20j`: move down 20 lines

Knowing how to move the cursor efficiently covers most day-to-day Vim use.

**Search**

`/text`: search forward for text  
`n`: go to the next match  
`N`: go to the previous match

In command mode, type a slash followed by the text to search for it. Then use `n` for the next result and `N` for the previous one.

**Copying and deleting**

`yy`: copy a line  
`dd`: delete a line

Prefix a command with a number to operate on that many lines. For example:

`100dd`: delete 100 lines

In practice, I sometimes use `gg` followed by `10000dd` to delete an entire file.

**Undo**

`u`: undo the last operation

**Paging**

`Ctrl` + `f`: page down  
`Ctrl` + `b`: page up

**A few handy tricks**

`Ctrl` + `z`: suspend Vim; type `fg` in the shell to return  
`zt`: place the current line at the top of the screen  
`zb`: place the current line at the bottom of the screen  
`zz`: center the current line on the screen

March 3, 2024, in Suzhou
