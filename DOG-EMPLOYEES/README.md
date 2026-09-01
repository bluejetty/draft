# DOG-EMPLOYEES

The staff room. Two jobs, a folder each, and the manual for a job sits in the
folder of the dogs who do it.

```
DOG-EMPLOYEES/
  DRIVETHRU-DOGS/     takes the order
    GUIDEBOOK-drive-thru-window.md
  DRAFTING-DOGS/      builds what was ordered
    GUIDEBOOK-home-plan-building.md
```

Gruff currently works both shifts. He is the first operator, not the only one.

## What goes where

**A guidebook is the procedure.** It is the same for everyone on that shift and
does not mention any particular dog. Question order, room minimums, stair
rules — the job, not the worker.

**A dog file is the variation.** One file per dog: name, seed, and the only
things that differ between them. Window dogs get their wording. Drafting dogs
get their sheet quirks and their taste preset.

The test of whether these are separated properly: **hiring a dog should mean
writing one new file and touching nothing else.** If you find yourself editing
a guidebook to add a dog, something has leaked.

And the matching warning: a dog file that starts getting long means a rule is
being smuggled into a personality. Rules belong in the guidebook, where every
dog is held to them.

## Two notes on scope

The building guidebook is filed here because the drafting dogs work from it,
but they are not its only readers — TOY MODE reads it to keep a beginner inside
buildable geometry, and RABBIT will read it to generate plans. Neither is a dog.

Professor Gruff, who writes notes inside the model, is a different character
doing a different job and is not an employee of either shift. Name to be sorted
later; kept apart here so the rename stays a rename.

## On the payroll

**Drive-thru:** Gruff, and nobody else yet.

**Drafting:** Gruff on shift. Three drafts on the bench, none of them running
anywhere — Gilbert the Irish Terrier (plain and square), Chad the Chihuahua (1200
sq ft and under), Bob the Weiner Dog (long and narrow). They exist to be
argued with, and each ends with what's still open about him.

Each one carries a single axis. That's deliberate: a dog who differs on
everything is indistinguishable from a dog who differs on nothing. Most of a
dog's settings should sit at the default — he is extreme on one thing and
ordinary about the rest, which is what makes him recognisable.

A dog is a set of positions on a shared list of factors, not a personality.
Same list for everyone. **A new dog may add a factor to the list; he may never
keep a private one** — the moment one dog has a setting no other dog could
hold, the two can't be compared, and it's a rule wearing a costume.

Chad raises the first case nobody has an answer for — **a dog who can't take
the order.** Five bedrooms won't fit in 1200 sq ft without breaking the room
minimums, which he may never do, so he has to be able to decline. See his
file.

## The Boneyard

What's underneath the button: the dogs, the dials, the tunables, the
guidebooks, the bench. Everything buried.

It's a secret club in the way a thing sitting in plain sight is secret — only
because nobody looked. **Nothing in the Boneyard is locked, paid for, or
earned.** A user who asks is in, immediately, at whatever depth they asked
about. Visits decide what we *show first*, never what a person is allowed to
reach.

That distinction is the whole rule, and it's easy to lose. The moment a rung
reads "come back three times to unlock", it has stopped being a boneyard and
become a loyalty program, and that is very hard to take back out once shipped.

### The rites

You go deeper by **doing a thing, not by waiting.** A rite is an act, and
every one of them is available in the next thirty seconds — which is how the
Boneyard stays unlocked while still having an order to it. The rite is the
asking.

None can be failed. None can be bought. And each one ends by showing you the
next, so nobody is ever told to level up — they finish a thing and can see
there's further to go.

| | The act | What it opens onto |
|---|---------|--------------------|
| **I** | The House — press the button, get a plan | it exists, and you made it |
| **II** | The Order — answer the window instead of taking the defaults | the plan changes in front of you; it's yours now |
| **III** | The Hand — hold two plans of the same order side by side and say which you prefer | you just did what choosing a drafter means, so the dogs get names |
| **IV** | The Dial — change one thing and watch the house move | the plan has parts, and parts have reasons |
| **V** | The Line — draw one wall yourself | drafting mode, and the mess that comes with it |

The rule that keeps this from rotting: **a rite must be something they'd have
done anyway.** Invent a hoop that exists only to be jumped through and it is a
gate wearing robes.

## When a dog reaches a user

Not on the first visit. Someone who has never made a plan doesn't know what a
drafter is, and asking them to pick one is asking for an opinion about a thing
they haven't seen yet.

So the dogs stay backstage until the third rite. Press the button, get a
house. The choice appears when the question has become "want it drawn
differently?" — which they can answer, because by then they've compared two
plans and know what the answer would cost.

One rule holds the whole ladder together — **never show a control until
they've seen the thing it changes.** That is what each rite is for.

Two consequences worth fixing now, because they're cheap now and expensive
later:

- **The default is a dog, not the absence of one.** Gruff draws those first
  houses and simply doesn't introduce himself. If "no dog" were the default
  and dogs were bolted on at round four, the early plans came out of a
  different path than every plan after, and the first thing a returning user
  notices is that their house changed.
- **Every rung hides things, none of them changes the program.** Same
  generator the whole way up, so nothing made in round one stops working in
  round five.

## Not built yet

No dog file is loaded by anything. One dog per job for now, and everything
below is the door left open rather than a thing that runs:

- a picker for the drafting dog, saved with the drawing so a reopened plan
  comes back in the same hand
- the window dog assigned rather than chosen — nobody picks who is on the
  speaker at a drive-thru
- bench dogs, `onShift: false`, for trying a design theory on fifty plans
  before it is promoted into the guidebook
- whatever remembers which rites someone has passed — browser while they're
  anonymous, account once they sign up, and the two have to agree so that
  clearing cookies doesn't send a signed-up user back to the first rite
