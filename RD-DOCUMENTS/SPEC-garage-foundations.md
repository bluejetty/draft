# Garage foundations

What a garage stands on, what each option costs in concrete, and where the
door opening goes. Written 5 Sep from Movie's numbers; every figure here is
his unless it says otherwise.

## The three

A garage takes one of three foundations. Which are offered depends on whether
it is attached, and that rule is already in `project-page.js`:

```js
GARAGE_FOUNDATIONS = {
  attachedGarage: ['gradebeam', 'frostwall'],
  detachedGarage: ['thickened', 'gradebeam', 'frostwall'],
}
```

**The order is the rule.** The first entry is the default a drafter should see
first, and the comment above that object has always said so. Nothing reads the
order as a fact, though, so it is easy to miss: an agent reading the list on
5 Sep took the ZONE_ROWS datum as the default and guessed grade beam for the
detached garage, when the file had already said thickened edge.

**Attached garages cannot take a thickened edge.** Movie, 4 Sep: *"it will move
/ the house foundation is solid and will cause cracking."* A floating slab
fastened to something that does not float cracks at the joint.
`drawing-format.js` refuses to store it, so the list above is the drafter's
view of a rule rather than the rule itself.

| | depth of concrete | slab | notes |
| --- | --- | --- | --- |
| **thickened edge** | 1'-0" at the edge | 4" field, LEVEL | monolithic, on gravel, 45° taper |
| **grade beam** | 32" | 4", falls 1/8"/ft to the door | perimeter member, gravel inside it |
| **frost wall** | to the house's footing depth | 4", same fall | 8" concrete on a strip footing |

## Everything tops out 1'-2" above grade, except one

Movie moved grade to 1'-2" below the top of concrete on 4 Sep — *"if the house
is higher out of the ground it is easier to regrade afterwards... so they have
6" to slope around the perimeter."* On 5 Sep he carried that to the garage:
the 1'-2" is *"for the grade beam or frost wall"*, on *"all 3 detached"*.

`GRADE_MIN_BELOW_CONCRETE_IN = 8` stays a separate number. One is the line a
drafter cannot type past; the other is where the drawing puts it.

**The thickened edge cannot take it, and the reason is arithmetic.** It is
1'-0" of concrete *total*, so a top 1'-2" above grade would stand the whole
edge in the air. It sits at 10" — Movie, 5 Sep: *"a little higher sure better
for drainage."*

**And 10" is not a compromise, it is the number that keeps the floor still.** A
grade beam tops out at grade + 14" with its slab 4" under that, so its floor is
grade + 10". A thickened edge IS its own top of concrete. Both floors land at
grade + 10", so changing a detached garage's foundation moves the concrete and
leaves the door where it was. The cost is 2" of edge in the ground rather than
4", which is acceptable on a floating slab bearing on gravel — a garage that
needs frost protection takes the frost wall, which is what that option is for.

## The grade beam is a perimeter member

Gravel inside it under the slab, and under the driveway outside. **The slab
bears on fill, not on concrete.** A section that draws the beam as a raft
across the whole garage is wrong.

## The door opening

The front of the beam is cut out for the door. Measured down from the top of
the grade beam's concrete:

```
+14"   top of grade beam concrete, away from the opening
         ⎫  1'-0" BUCK cut out of the beam
+ 6"   ⎬    top of slab           ← 8" of buck still open above it
+ 2"   ⎭    top of the 20" concrete
  0"   grade — 2" under the bottom of the buck
−18"   bottom of concrete: the same flat dig as the beam either side
```

- 32" of beam less the 1'-0" cut leaves **20"** of concrete.
- The 4" slab pours on top of that 20", making **24"**.
- The slab **fills 4" of the buck up**, so **8" of buck is what you see**:
  `24 + 8 = 32`. Movie, 5 Sep: *"8" of buck is seen after the 4" slab poured
  because it is filled up."*
- The excavation is one flat bottom at grade − 18". Nobody digs a step.

**THE BUCK IS THE CUT-OUT, NOT A MEMBER.** This is the thing that took five
wrong reconstructions to get right on 5 Sep, and every one of them failed the
same way: the buck was read as a piece of wood sitting on the slab or in the
opening, and elevations were then derived from where that piece supposedly
sat. It is a void formed in the beam. Nothing sits on it.

The 1'-0" cut and the 8" remainder are **one fact seen from two faces** — cut
measured to the top of concrete, remainder measured from the top of slab. Four
of the five wrong versions came from applying the 1'-0" down to the top of
*slab*, which lands 4" out and invites an invented filler to cover the gap.

**The driveway is out of scope HERE, not everywhere.** Movie, 5 Sep: *"the
driveway doesn't matter it will just be a sloping slab we will line up"*, and
*"we may add something for driveway in landscaping area / site plan area."*

So no section draws it and no constant places it, and that is deliberate rather
than an omission: a driveway is a site thing, and it belongs on the sheet that
deals with the site. Recorded so nobody adds a driveway constant to a
foundation file on the grounds that the section looks unfinished without one.

The 1½" sill on the beam is deliberately left out of the stack above — Movie:
*"plus 1.5" sill we won't worry about now."* `GARAGE_BEAM_PLATE_IN` carries it
where it is needed.

## Not built

None of the opening detail is drawn yet, and no constant exists for the buck
or the cut. Band 3 on the PROJECT page — the DETACHED GARAGE section — is
where it lands first.
