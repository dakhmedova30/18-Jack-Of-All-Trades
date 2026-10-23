# Team 18 - Jack Of All Trades

 <!-- > _Note:_ This document is meant to be written during (or shortly after) your review meeting, which should happen fairly close to the due date.      
 >      
 > _Suggestion:_ Have your review meeting a day or two before the due date. This way you will have some time to go over (and edit) this document, and all team members should have a chance to make their contribution. -->


## Iteration 01 - Review & Retrospect

 * When: October 22, 2026
 * Where: Online

## Process - Reflection


#### Q1. What worked well

List **process-related** (i.e. team organization and how you work) decisions and actions that worked well.
 * 2 - 4 important decisions, processes, actions, or anything else that worked well for you, ordered from most to least important.
 * Give a supporting argument about what makes you think that way.
 * Feel free to refer/link to process artifact(s).

1. Designing UI/UX in Figma before implementation
<img width="994" height="578" alt="image" src="https://github.com/user-attachments/assets/cab05986-c8b3-4da1-9e02-b9c666139203" />

Designing the UI/UX in Figma before writing code worked extremely well for us, because it gave the whole team one shared picture of the finished app. Everyone building different pages (Home, Inventory, Sales, Expenses, Analytics) followed the same layout patterns (toolbar, data table, summary cards) so the pages stayed consistent without constant coordination. Changes were also cheap because rearranging components on Figma takes minimal time compared to rewriting the code for the pages, so team members can quickly get a visual representation of their suggestions for feedback.
   
2. Clear Task Ownership
<img width="1474" height="412" alt="image" src="https://github.com/user-attachments/assets/9cc3c180-25a3-4df9-85ad-06bd56320c34" />

Giving each team member clearly defined ownership of a feature or area worked well for us. For example, one person would implement login and authentication, while another would work on theme and styling. Since it was always clear who was responsible for what, we avoided duplicated work and the confusion of multiple people changing the same thing. Additionally, this let people work in parallel on their own feature branches without waiting on a teammate to push code first, which allowed constant progress. 

3. Communications & Meeting

Regular communication (through Discord) and meetings also worked well for us. In addition to the weekly tutorial, our team have a meeting online on Mondays, and this gave us a fixed time to check in. Every meeting, we went over what everyone did, what they were working on and what (if any) issues they were dealing with, which served as a refresher on our tasks. Our group chat also let us set clear expectations and deadlines so everyone knew what was expected of them (in our meeting on Monday 19th October, we made it clear that frontend and UI had to be done for Demo day on the 22nd). 
#### Q2. What did not work well

List **process-related** (i.e. team organization and how you work) decisions and actions that did not work well.

 * 2 - 4 important decisions, processes, actions, or anything else that did not work well for you, ordered from most to least important.
 * Give a supporting argument about what makes you think that way.
 * Feel free to refer/link to process artifact(s).


#### Q3(a). Planned changes

 * **Expand Sales and Expense Tracking:** We plan to add more detailed fields to our sales and expense trackers, including currency, discounts, tips, and other relevant transaction information. We will also categorize sales by source, such as in-person markets, online stores, commissions, and miscellaneous sales. This will allow business owners to better organize their transactions and understand where their revenue is coming from.
 * **Improve the Analytics Dashboard:** We plan to expand our analytics dashboard to provide more detailed insights into business performance. This includes breaking down revenue by sales channel, tracking expenses, and providing clearer visualizations of sales trends. These improvements will help business owners make more informed decisions using their recorded data.
 * **Refine UI/UX Consistency:** Based on feedback, we plan to improve the overall visual consistency of our application by standardizing fonts, colors, cards, and navigation tabs. Since different components were developed by different team members, these changes will help make the application feel more cohesive and easier to navigate.
 * **Improve Integration and Testing:** As we add new fields and features, we plan to spend more time testing how our frontend, backend, and database work together. This will help ensure that newly added transaction details are stored correctly and accurately reflected in the analytics dashboard.

#### Q3(b). Integration & Next steps

 * Our team divided development between frontend (React/TypeScript) and backend (Node.js/Express/PostgreSQL), with members working on separate features tracked through Jira. We integrated these components through REST APIs and a shared database, using feature branches and reviewed pull requests to merge changes. Moving forward, we plan to expand sales and expense tracking, improve analytics, and refine UI consistency based on feedback.


## Product - Review

#### Q4. How was your product demo?
* For our demo, we presented the MVP based on our individual roles. We demoed the basic features planned in D1: the sales, inventory, expenses, and analytics pages. The demo also included a login page and a more fleshed-out interface. We received suggestions on how information is laid out and on appearance, and we plan to expand the MVP to include more detailed analytics features.
* From a product perspective, we learnt the importance of information delivery, from how text is shown on screen to where components are placed.
