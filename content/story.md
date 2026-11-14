Su-27 Flanker has a spare, very recognisable look: turquoise aircraft, green terrain, a banded sky, and a cockpit packed with small instruments. The geometry is simple enough to invite inspection. The simulation behind it takes rather longer to understand.

We wanted to reconstruct the game in C++, following the work on [Darker](https://lost-engines.github.io/darker-discovered/), [TFX](https://lost-engines.github.io/tfx-traced/) and [Earthsiege](https://lost-engines.github.io/earthsiege-exhumed/). That meant recovering the files, finding out how the engine used them, and checking the new code against the original. Along the way we found damaged missions, a second landscape kept for old recordings, and a car whose windows only work if you draw it in the right order.

<div class="exhibit-links" aria-label="Interactive exhibits">
<a href="models/"><strong>Models</strong><span>Open the gear, sweep the wings, deploy a parachute.</span></a>
<a href="missions/"><strong>Mission map</strong><span>Follow the routes and read the original briefings.</span></a>
<a href="cockpit/"><strong>Cockpit</strong><span>Inspect the artwork, symbols and mirror masks.</span></a>
</div>

## Finding a reference version

The first job was sorting out what we actually had. The collection included DOS and Windows releases, demos, patches, regional packages and community modifications. A newer-looking disc was not necessarily a reliable guide to the files an installation would use. The Squadron Commander’s Edition disc, for example, contains an older `FSIM.EXE`; the installed 1.5 simulator runs from `FSIM.LBB`.

Extensions were another small trap. An `.LBB` file can be an archive or an executable. The DOS game has a launcher, a mission editor and a flight module; Windows has an editor executable and a separate flight module. Identifying the file headers was more useful than guessing from the names.

We settled on a clean Windows Squadron Commander’s Edition 1.5 installation as the reconstruction reference, keeping the other editions for comparison. The DOS and Windows 1.1 releases share all four principal data archives byte for byte. Patch 1.2 changes the editor and flight executables while leaving the shared data alone. Version 1.5 changes the model collection substantially, but retains the earlier cockpit and terrain archives.

The final edition contains 364 shape resources and 208 distinct mission files. Those shapes include buildings, markings, weapons, wreckage and effects as well as vehicles. Twenty-six numbered Su-27 variants account for some of the growth: the mission’s aircraft type selects a paint scheme, while the geometry and flight data remain the same.

<figure class="wide"><img src="images/original-external.png" width="640" height="480" class="pixel" loading="lazy" alt="Original Windows Flanker: a turquoise Su-27 on the runway, with a striped sky and green hills behind it."><figcaption>The original Windows 1.5 game, at 640 × 480. The black desktop border around the capture has been cropped away.</figcaption></figure>

## A model file can open the landing gear

Decoding vertices and polygons gave us recognisable aircraft fairly early. Getting those aircraft to behave correctly in the model browser took more work. The Su-27 is assembled from 41 named shape nodes, with control surfaces, gear, canopy, pilot and afterburners under separate transforms. Some of the original names survive: `SubPilot`, `SubFonar`, `SubFlaps`, `SubForsaj`.

A parent shape can translate, rotate or scale a child, apply a curve to an input, test a flag, or attach another model. The game supplies a small set of parameters. The model decides what those values do to its parts. A single landing-gear input can therefore move several doors and struts through different stages of travel.

That made the first generic sliders useful, but also quite misleading. A flag word is much easier to understand as “pilot present” and “braking chutes” checkboxes. An attachment selector should offer a missile or a marking, rather than every model in the archive. Several controls only change over a small part of the available numerical range. The afterburner begins around the value 4096; most of a full signed-word slider would do nothing useful.

The MiG-23 wing-sweep input was a particularly good example. It looks like an angle when you first move it. Tracing the writer showed that it is Mach number, multiplied by 4096. Curves in the model turn that into two short sweep transitions, with long plateaux between them. We could then label the control with what the game actually supplies.

The ejection sequence is split between `chear`, the seat, and `epilot`, the separated pilot. Their shapes contain the rocket, drogue, main parachute and body animation stages. Small random rotations add movement to the canopy. The public viewer exposes those stages directly; try the parachutist’s deployment slider, or the Il-76’s cargo ramp.

<figure class="wide"><a href="models/#epilot"><img src="images/model-exhibits.png" width="1440" height="720" loading="lazy" alt="Recovered Su-27 geometry beside the ejection seat and a pilot under an open parachute."></a><figcaption>Selected shapes in the browser renderer. The controls run the recovered model commands; this is an inspection view, not a screenshot of the original renderer. <a href="models/">Explore the models.</a></figcaption></figure>

## The car with the disappearing windows

One of the more awkward rendering bugs involved the least impressive vehicle in the collection. The little red `car1` model appeared to have a solid red rear windscreen. Rotate it far enough and a narrow white sliver would appear. The obvious suspects were reversed polygons or a bad normal.

The normals were fine. The rear window was entirely underneath the body panel. The front window intersected its panel, and its slope was slightly different too.

The original renderer gets away with this because the model supplies view-dependent drawing lists. They paint the body, then paint the window over it. A modern depth buffer instead compares the surfaces at each pixel and correctly hides the buried window. For this model, geometrically correct visibility produces the wrong picture.

We checked four upright front and rear views by running the original software drawing code. The windows were visible there, and our recovered painter produced the same pixels. For the browser preview, the fix was to project those two window faces onto their supporting panels and use the panels’ visibility. The source geometry stays intact.

This also helped explain why apparently minor details—flags, hull lettering, wheels and grilles—needed care. An authored drawing order can carry assumptions that are absent from the vertex data. Importing the polygons into a contemporary renderer does not automatically reproduce the image.

<figure><img src="images/window-order.svg" width="960" height="370" loading="lazy" alt="Schematic cross-section: a window lies beneath the body panel. Painter order draws it last; a depth test hides it."><figcaption>A schematic of the car-window problem. The separation is exaggerated; these are not measured model coordinates. <a href="models/#car1">Inspect the car.</a></figcaption></figure>

## Two renderers, much of the same work

Flanker’s flat mode draws in software. Windows also has a smooth OpenGL path, which initially sounds like a clean division between a software and a hardware 3D engine. The calls tell a more specific story.

The CPU has already transformed and clipped the geometry, and worked out its drawing order, before OpenGL receives it. The imported entry points include two-dimensional vertex calls and an orthographic projection. OpenGL is drawing projected polygons rather than taking over the whole world-to-screen calculation.

That arrangement preserves much of the original machinery across both outputs. It also explains why selecting OpenGL is no guarantee of a speed-up in the reconstruction: the CPU work remains, and the cost of submitting many small draws can dominate. We have kept the software path and worked on its performance in Redux. A new hardware renderer would be a separate architectural project.

<figure class="wide"><img src="images/rendering.svg" width="1100" height="370" loading="lazy" alt="Shapes and terrain pass through CPU animation, transforms, clipping and ordering, then split into software spans or projected OpenGL polygons."><figcaption>The recovered Windows rendering paths. Both start with the engine’s CPU geometry work.</figcaption></figure>

## The landscape kept for old recordings

Two terrain archives, `MAP` and `MAP0`, accompany the game. At first glance they look like candidates for different detail levels or graphics modes. Following mission startup gave us the answer: version 1.5 selects `MAP0` when replaying an old-format FM10 recording. A normal mission starts in the newer FM15 runtime and uses `MAP`.

A recorded flight has to reproduce more than the pilot’s inputs. Change the ground underneath a low approach and the same controls may lead to a different landing—or a collision. The older terrain is part of the replay compatibility machinery, alongside the legacy simulation path. This is why deduplicating an installation solely on “these files look nearly the same” would have been a mistake.

The full retail game includes demonstration flights. They are not restricted to the demos sold or distributed separately. There are airmanship lessons, aerobatics, air-combat sweeps and weapon demonstrations, with camera changes and briefings that invite the player to take over using Escape. The `.trk` files contain mission data followed by timed input; some `.mis` files also carry a recording after the mission section.

We ran 115 intact supplied tracks through to the end in the reconstruction. Three bonus tracks are truncated. Separately, two supplied mission recordings were used for detailed comparisons against the original simulation, running for 9,833 and 5,676 ticks. Completing a track and matching its internal states are different checks, so we keep those results separate.

<div class="aside"><p><strong>Explore the terrain.</strong> The <a href="missions/">mission map</a> shows a selection of the supplied scenarios over decoded MAP geometry. Select an aircraft to follow its route. This is a plan view of mission data; it does not replay the flight.</p></div>

## Four missions damaged by a newline conversion

Some of the bonus missions would not parse. The failures were not consistent with an unknown mission format. Lengths and coordinates became nonsensical at particular places, then the surrounding structure became recognisable again.

Four files in the HMASP competition set had acquired a carriage-return byte before every line-feed byte. That is a perfectly ordinary conversion for a text file. In a binary mission, a byte with the value ten might be part of a coordinate, a count or any other field. Inserting a byte shifts everything after it.

The repair removed 42, 43, 45 and 42 inserted bytes respectively. We accepted it only when converting the repaired bytes back to CRLF reproduced the entire damaged source exactly, and the full mission parser then succeeded. The original files remain unchanged; the recovered readings are labelled separately. The bytes establish the conversion, but do not tell us which transfer tool or person caused it.

<figure><img src="images/newlines.svg" width="960" height="280" loading="lazy" alt="A binary byte sequence 34 0A 12 becomes 34 0D 0A 12 after text-mode newline conversion, shifting the next field by one byte."><figcaption>A representative byte sequence, illustrating the damage. The affected files were WARMUP, POWERUP, MISSION4 and MISSION5.</figcaption></figure>

## The Windows-looking DOS editor

The Windows mission editor uses native controls through MFC. The DOS editor looks similar enough that we wanted to know how much was shared. Its `MAPEWIN.RES` file contains standard Windows resource records, including dialog layouts. Every one of the 187 resources shared by the DOS and Windows 1.1 editors is byte-identical. Many remain unchanged in 1.5.

So the resemblance has a concrete basis: the same dialog descriptions and artwork feed both interfaces. DOS still needs its own code to draw and operate those controls. The resource comparison does not identify who wrote that widget layer, and we have not assigned it to a particular library.

The editor also explains some of the game’s less obvious behaviour. “Declassify mission” asks for an author’s editing password, not a campaign unlock code. Classification restricts what can be edited: a squadron leader can change their player group, while a general has broader control over their side’s forces. The mission itself is not encrypted. The short password field is stored with its characters reversed and an offset added to each byte.

Other discoveries were things the interface hints at but never offers. There is a “Heavy” cloud label in the resources, yet the active weather dialog adds only Clear and Light. Finding that string alone would not have been enough to claim a hidden heavy-cloud mode.

<figure class="wide pair"><div><img src="images/dos-editor.png" width="640" height="480" class="pixel" loading="lazy" alt="DOS mission editor with its Windows-like Open dialog."><img src="images/dos-weather.png" width="640" height="480" class="pixel" loading="lazy" alt="Weather dialog in the original DOS mission editor."></div><figcaption>Original DOS editor captures. Shared resources explain the familiar layout; DOS supplies the drawing and input handling.</figcaption></figure>

## Giving the flight-model numbers names

The aerodynamic tables were easy to extract and harder to describe. A column of numbers is not much help to a future maintainer if all we can call it is “coefficient three”. We traced the calculations that consume each value, then changed one input at a time while running the original routine to see what moved.

That identified five Mach-dependent outputs: base drag, lift-dependent drag, lift slope, roll-command gain and the positive angle-of-attack command limit. Those names describe their role in the game. They are neither recovered source-code names nor measurements of a real Su-27.

There are useful details in the equations. Ordinary-flight drag contains both a squared-lift term and a fourth-power term, which makes drag rise more sharply at high lift. Flap lift is added after the lift value used in those terms; flap drag is supplied separately. Pitch response follows a damped controller moving angle of attack towards a demand. Departure, tail-slide and Cobra states have their own handling, so one tidy equation would not describe the whole flight model.

These distinctions came from tracing and experiments. A plausible-looking curve by itself could easily have led us to the wrong label.

<figure class="wide"><img src="images/aerodynamics.svg" loading="lazy" alt="Recovered curves for drag, lift slope, roll-command gain and angle-of-attack command limit across Mach number."><figcaption>Outputs sampled from the original aerodynamic calculations. The discontinuities in roll gain and the AoA limit come from the original interpolation code.</figcaption></figure>

## Checking a reconstruction

For small routines, we can execute the original x86 instructions in a controlled harness, give both implementations the same inputs, and compare the outputs. That gives us a way to test integer rounding, state transitions, drawing commands and individual pixels without relying entirely on a visual impression.

The cockpit was particularly suited to this. Its finished image combines palette artwork, one-bit symbols, vector lines, needles, warnings and separately rendered mirror views. The component formats and the composition code could be checked in stages, then checked together as assembled frames. The public <a href="cockpit/">cockpit exhibit</a> shows some of those pieces.

Longer tests exercised recorded flights, landing approaches and consecutive rendered frames. They caught integration errors that isolated functions could not. Playtesting caught more: incorrect UI behaviour, culling problems at particular camera angles, and a chase camera using the wrong time scale. A collection of passing probes is useful evidence; flying the game is still necessary.

Some findings remain deliberately modest. An unregistered shape is not necessarily unused: code may reach it by another route. An extra bitmap outside a reference table is worth recording, but does not by itself prove a cut feature. The key audit found commands absent from the quick-reference card, including wingman-text toggling and accelerated external-camera movement. It did not find an invulnerability or unlimited-ammunition input in the examined 1.5 flight handlers. Ground rearming and refuelling were already documented controls.

## Where the work ended up

The result is [Su-27 Flanker C++](https://github.com/Lost-Engines/su-27-flanker-cpp), a reconstruction intended to follow the original game, and [Su-27 Flanker Redux](https://github.com/Lost-Engines/su-27-flanker-redux), where we can change the presentation and controls. Keeping them separate lets us distinguish a fidelity fix from a deliberate improvement.

The work also left a much more readable account of how this particular simulator fits together: the data its models consume, the terrain its recordings expect, and the calculations behind its instruments and aircraft. The exhibits here are a small selection of that material. If you want the evidence behind a particular section, the [source notes](sources/) identify the working documents and link the reconstruction checks.
