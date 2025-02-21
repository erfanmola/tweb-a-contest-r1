Hi, here is the overall implementations and their explanations.

Task 1 (Text Editor)
Not much has been done on this. Due to certain issues, I only had time to fix the obvious ctrl+z issue and add support for Quotes, all done based on the existing editor.

Task 2 (Folders)
The given mockup has been implemented, not much to say, most scenarios are handled and tested, here is the list:
- Responsive design & keep the tabbar in Mobile
- Dynamically update folders data based on real-time updates
- Show only when has folder
- Respect no title animations

Task 3 (Animated Background)
The task has been implemented, the solution is based on the combination of @edward's gradient renderer that I refactored to Web A codebase. Unlike Web K, I used CSS solution for patterns. I believe browser can handle background images in more efficient way than I draw it on canvas.
So here is what is handled:
- Default Dark/Light
- Animated Backgrounds Dark / Light
- Animated Dark Backgrounds in Light Mode
- Color Backgrounds
- Image Backgrounds
- Support for Blur and Disable Blur on non-blurable items

One thing that is missing is support for per-chat background images, which I found it out of scope of this contest.

About the Task 1, I initially started an empty React project and implemented a basic AST based text editor (called it teletextor), it worked completely by relying on keypress events, the div used for rendering content was not contentediatble directly, rather controlled by caret range and only reflecting changes on the given real-time ast node. Though maintaining the caret position across all scenarios was hard.

My second thoughts were: we already have a working editor in Web K, why not migrate it to Web A? So I spent 2 days on migrating the Web K editor into Web A (you can see the files as archive in src/teletextor), Though I did not finish it because it was already +30KB of code and lots of non-reusable wasted code from Web K codebase, so I did not continue it.

I also had some approaches on canvas based solutions, which I knew were shitty and telegram would never do such a shit.

So that's all for today.