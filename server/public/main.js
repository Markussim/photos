fetch("/api")
  .then((response) => response.json())
  .then((data) => {
    const ul = document.getElementById("photos");
    data.forEach((key) => {
      const a = document.createElement("a");
      a.href = `/photo/original/${key}`;
      a.target = "_blank";
      const img = document.createElement("img");
      const blankImage =
        "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";
      img.src = `${blankImage}`;
      img.alt = key;

      a.appendChild(img);
      ul.appendChild(a);
    });
  })
  .then(() => {
    let observer = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            let img = entry.target;
            // Use the alt attribute or a data attribute to get the actual image URL
            const src = "photo/thumbnail/" + img.alt;
            img.src = src;
            observer.unobserve(img);
          }
        });
      },
      {
        rootMargin: "0px",
        threshold: 0.1,
      }
    );

    document.querySelectorAll("img").forEach((img) => {
      observer.observe(img);
    });
  });
