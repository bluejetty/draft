# BOARD — the garage tie, and two rulings that disagree

**Movie, 21 Sep 2026**, on his own drawing:

> *"also where the garage hooks into the house the foundation, main floor and
> 2nd floor should connect all the same (1ft in from corner)"*

Status: **MEASURED, ATTEMPTED, BACKED OUT — it needs one word from Movie.**
`proto/repro-movie-garage-2storey.draft` is the file, so every number here is
his own drawing's.

---

## He is right that they differ

The connector that carries the garage's proud 4 ft into the house's right
wall, per level:

    FOUNDATION   (16, 19) -> (20, 19)     z = 19, one foot in from the corner
    MAIN FL      (16, 19) -> (20, 19)     z = 19, the same
    2ND FL       (16, 20) -> (20, 20)     z = 20, ON the corner

So the second-floor wall stands a foot in FRONT of the wall beneath it for
that four-foot stretch. Nothing is under it there.

## And the code knows it, on purpose, in three places

`premade-plans.js` carries the decision three times over, each with a
different reason:

**1. `overGarageLoop` (:341)** -- *"FROM THE HOUSE'S FRONT WALL, not from the
tie. The tie is a one-foot strip of garage that reaches back along the house's
side wall; a room starting there would hang a foot past the house's own front
face."*

**2. `houseRoofLoop` (:591)** -- *"the tie is single storey, and taking it
into this loop would put the two-storey roof over a body a floor lower, which
is the very thing houseRoofLoop's storey test exists to refuse."*

**3. `garageRoofLoop` (:433)** -- and this is the one that matters, because it
is MOVIE'S OWN EARLIER RULING:

> **Movie, 20 Sep**, on the E4 RIGHT elevation of a 2 STOREY + GARAGE: *"when
> the main floor garage roof connects to the house that has 2 storey it should
> be gabled on the house end (not cottage) i think this was a problem on
> model.dc but was solved"*

and the file's resolution of it:

> *"Taking that jog into the roof leaves a four-foot edge at z = 19 which is
> NOT on the house, so it gets an eave and hips: a little triangle of roof
> tucked against the house wall, which is the 'cottage' end he is objecting
> to. **THE TIE IS A FOUNDATION DETAIL AND THE ROOF IS NOT A FOUNDATION.**"*

**And his reason for the tie existing at all is recorded there too**: *"rather
than fitting the concrete move it over 1ft exactly easier to construct"* --
so the tie was asked for to make the POUR easier.

---

## The attempt, and what the harness said

`overGarageLoop` was given the garage's own six-point step -- shared run,
house corner, tie down the right wall, proud rear wall, right side, front --
and the window indices shifted 2,3,4 to 3,4,5 with them.
`proto/premade-plans-harness.js` went from 103/103 to 98/103, and **four of
the five failures were the design disagreeing rather than the edit being
sloppy**:

    the room is 24 x 18                  got 24 x 19   the tie adds a foot
    two thirds of the garage's length    got 0.704     was 2/3
    it starts at the house's front wall  got 19        the check IS the ruling
    exactly one edge shared with house   got 2         20 ft run + the 1 ft tie
    every corner of the room is under
      the house roof                     got 1 out     <- the real one

**That last one is the change refusing to be local.** The house roof
deliberately stops at the house's front line, so a room reaching back to
z = 19 has a corner standing outside its own roof. Meeting Movie's
instruction properly means the ROOM, the HOUSE ROOF and the GARAGE ROOF all
take the tie -- and the third of those is the cottage end he rejected on
20 Sep.

**ONE CHECK'S EXACTNESS WAS LUCK, and it is worth knowing before anyone
re-runs this.** *"Two thirds of the garage's length"* compared the room's
bounding box (18, no tie) against the garage's (27, with tie) and got 2/3 to
the digit. Make the two bodies consistent and it becomes 19/27 = 0.704, or
18/26 = 0.692 measured like for like. Neither is 2/3. The number was an
artifact of comparing a body that had the tie with one that did not.

---

## THE ONE WORD NEEDED, because two of his rulings now point opposite ways

    20 Sep   the roof must NOT follow the tie -- no cottage end
    21 Sep   all three levels must connect the same

Three consistent answers, and they are three different buildings:

**(a) ALL THREE AT z = 19** -- his 21 Sep instruction taken literally. The
room, the house roof and the garage roof all take the tie. Re-opens the
cottage end he rejected, and puts the two-storey roof over what is currently
a single-storey foot of garage -- unless that foot becomes two storeys, which
it would, since the room would stand on it. Self-consistent, but it is a
building change and it reverses 20 Sep.

**(b) FOUNDATION AT 19, MAIN AND 2ND AT z = 20** -- *"the tie is a foundation
detail"* taken consistently, which is the file's own stated rule. This is the
answer his own 20 Sep ruling implies, and it means **the MAIN FLOOR is the
one that is wrong today**, not the second. It also keeps the roof exactly as
he approved it.

**(c) LEAVE IT** -- foundation and main at 19, second at 20. Only defensible
if the second-floor wall is meant to bear on the deck rather than on the wall
below, and nothing in the thread says that.

**Not guessed at.** (a) and (b) differ in which level gets edited and one of
them undoes work he signed off a day earlier. The measurement is done and the
attempt is proven to cascade into both roofs, so whichever he picks is now
cheap to build.
